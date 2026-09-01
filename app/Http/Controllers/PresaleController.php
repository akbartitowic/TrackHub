<?php

namespace App\Http\Controllers;

use App\Models\Presale;
use App\Models\PresaleOperationAssignment;
use App\Models\PresaleRoleRequirement;
use App\Models\Project;
use App\Models\ProjectMember;
use App\Models\ProjectRoleQuota;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use App\Traits\LogActivity;

class PresaleController extends Controller
{
    use LogActivity;

    public function index()
    {
        $items = Presale::with([
            'company:id,name',
            'projectCategory:id,name',
            'roleRequirements.role:id,name',
            'operationAssignments.role:id,name',
            'operationAssignments.user:id,name,email',
        ])->orderBy('created_at', 'desc')->get();

        return response()->json(['data' => $items]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'company_id' => 'required|exists:companies,id',
            'project_name' => 'required|string|max:255',
            'project_category_id' => 'required|exists:project_categories,id',
            'estimated_budget' => 'required|numeric|min:0',
            'project_description' => 'nullable|string',
            'status' => 'nullable|string',
            'sales_pitch_id' => 'nullable',
        ]);

        if (!isset($validated['status'])) {
            $validated['status'] = 'Lead';
        }

        $validated['name'] = $validated['project_name'];
        $validated['estimated_value'] = $validated['estimated_budget'];
        $validated['description'] = $validated['project_description'] ?? null;

        $presale = Presale::create($validated);
        $this->log('Presales', 'Created Opportunity', "Created new lead entry: {$presale->project_name}");
        return response()->json(['id' => $presale->id]);
    }

    public function updateBusiness(Request $request, string $id)
    {
        $presale = Presale::findOrFail($id);

        $validated = $request->validate([
            'deck_url' => 'nullable|string|max:2048',
            'quotation_url' => 'nullable|string|max:2048',
            'drive_url' => 'nullable|string|max:2048',
            'methodology' => 'required|in:Agile Scrum,Waterfall',
            'total_manhours' => 'nullable|numeric|min:0',
            'project_role_ids' => 'required|array|min:1',
            'project_role_ids.*' => 'required|exists:project_roles,id',
            'business_role_mh' => 'nullable|array',
        ]);

        if ($validated['methodology'] === 'Agile Scrum' && !isset($validated['total_manhours'])) {
            return response()->json(['message' => 'Total MH wajib diisi untuk Agile Scrum.'], 422);
        }

        $roleIds = collect($validated['project_role_ids'])->map(fn ($v) => (int) $v)->unique()->values();
        $existingRequirements = $presale->roleRequirements()->get()->keyBy('project_role_id');

        // Business cannot remove roles already used by operation assignments
        $usedByOperation = $presale->operationAssignments()->pluck('project_role_id')->unique();
        $missingUsedRoles = $usedByOperation->diff($roleIds);
        if ($missingUsedRoles->isNotEmpty()) {
            return response()->json([
                'message' => 'Role bisnis tidak boleh lebih kecil dari role yang sudah dipakai tim operation.',
            ], 422);
        }

        DB::beginTransaction();
        try {
            $businessRoleInput = collect($validated['business_role_mh'] ?? [])->mapWithKeys(fn ($v, $k) => [(int) $k => $v]);

            // Per-role Business MH: UI may only send Total MH (no per-role breakdown). Then every role
            // would otherwise save as 0 and Tech validation (dev <= business per role) wrongly rejects.
            $perRoleBusiness = [];
            foreach ($roleIds as $roleId) {
                $raw = $businessRoleInput->get($roleId);
                if ($raw === null || $raw === '') {
                    $perRoleBusiness[$roleId] = 0.0;
                } else {
                    $perRoleBusiness[$roleId] = (float) $raw;
                }
            }

            if ($validated['methodology'] === 'Agile Scrum') {
                $budget = (float) ($validated['total_manhours'] ?? 0);
                $sumBreakdown = array_sum($perRoleBusiness);
                $roleCount = $roleIds->count();
                if ($budget > 0 && $sumBreakdown < 0.00001 && $roleCount > 0) {
                    if ($roleCount === 1) {
                        $onlyId = (int) $roleIds->first();
                        $perRoleBusiness[$onlyId] = $budget;
                    } else {
                        $each = round($budget / $roleCount, 4);
                        $allocated = 0.0;
                        foreach ($roleIds->values() as $idx => $roleId) {
                            $rid = (int) $roleId;
                            if ($idx === $roleCount - 1) {
                                $perRoleBusiness[$rid] = round(max(0, $budget - $allocated), 4);
                            } else {
                                $perRoleBusiness[$rid] = $each;
                                $allocated += $each;
                            }
                        }
                    }
                }
            }

            $toKeep = [];
            foreach ($roleIds as $roleId) {
                $mh = null;
                if ($validated['methodology'] === 'Agile Scrum') {
                    $mh = $perRoleBusiness[(int) $roleId] ?? 0;
                }

                $row = $existingRequirements->get($roleId);
                if ($row) {
                    if ($row->development_mh !== null && $mh !== null && $mh < (float) $row->development_mh) {
                        DB::rollBack();
                        return response()->json([
                            'message' => "Business MH untuk role ID {$roleId} tidak boleh kurang dari data development.",
                        ], 422);
                    }

                    $row->business_mh = $mh;
                    $row->save();
                } else {
                    PresaleRoleRequirement::create([
                        'presale_id' => $presale->id,
                        'project_role_id' => $roleId,
                        'business_mh' => $mh,
                        'development_mh' => null,
                    ]);
                }
                $toKeep[] = $roleId;
            }

            $presale->roleRequirements()
                ->whereNotIn('project_role_id', $toKeep)
                ->whereNull('development_mh')
                ->delete();

            if ($validated['methodology'] === 'Agile Scrum') {
                $devTotal = (float) $presale->roleRequirements()->sum('development_mh');
                if ((float) $validated['total_manhours'] < $devTotal) {
                    DB::rollBack();
                    return response()->json([
                        'message' => 'Total MH bisnis tidak boleh kurang dari total MH development.',
                    ], 422);
                }
            }

            $presale->update([
                'deck_url' => $validated['deck_url'] ?? null,
                'quotation_url' => $validated['quotation_url'] ?? null,
                'drive_url' => $validated['drive_url'] ?? null,
                'methodology' => $validated['methodology'],
                'total_manhours' => $validated['methodology'] === 'Agile Scrum' ? (float) $validated['total_manhours'] : null,
            ]);

            DB::commit();
            return response()->json(['status' => 'success']);
        } catch (\Throwable $e) {
            DB::rollBack();
            return response()->json(['message' => $e->getMessage()], 500);
        }
    }

    public function acknowledgeBusiness(Request $request, string $id)
    {
        $presale = Presale::findOrFail($id);
        $presale->update([
            'business_acknowledged_at' => now(),
            'business_acknowledged_by' => $request->user()?->id,
        ]);
        $this->log('Presales', 'Business Acknowledged', "Business acknowledged for {$presale->project_name}");
        return response()->json(['status' => 'success']);
    }

    public function updateDevelopment(Request $request, string $id)
    {
        $presale = Presale::findOrFail($id);
        if (!$presale->business_acknowledged_at) {
            return response()->json(['message' => 'Tab Development aktif setelah Business acknowledge.'], 422);
        }

        $validated = $request->validate([
            'development_role_mh' => 'nullable|array',
        ]);

        DB::beginTransaction();
        try {
            $devInput = collect($validated['development_role_mh'] ?? [])->mapWithKeys(fn ($v, $k) => [(int) $k => $v]);
            $requirements = $presale->roleRequirements()->with('role')->get();
            foreach ($requirements as $requirement) {
                $roleId = (int) $requirement->project_role_id;
                $raw = $devInput->get($roleId);
                $newMh = ($raw === null || $raw === '') ? null : (float) $raw;

                if ($presale->methodology === 'Agile Scrum') {
                    if ($newMh === null) {
                        DB::rollBack();
                        return response()->json(['message' => 'Semua role wajib diisi estimasi MH pada tab Development.'], 422);
                    }

                    $businessCap = $requirement->business_mh !== null ? (float) $requirement->business_mh : null;
                    // Legacy / UI tanpa breakdown per role: DB bisa masih 0 sementara Total MH sudah diisi.
                    if (($businessCap === null || $businessCap < 0.00001) && (float) ($presale->total_manhours ?? 0) > 0) {
                        $roleCount = $presale->roleRequirements()->count();
                        if ($roleCount === 1) {
                            $businessCap = (float) $presale->total_manhours;
                        }
                    }
                    if ($businessCap !== null && $newMh > $businessCap) {
                        DB::rollBack();
                        $roleLabel = $requirement->role->name ?? "ID {$roleId}";
                        return response()->json([
                            'message' => "MH Development untuk «{$roleLabel}» ({$newMh}) tidak boleh melebihi MH Business per role ({$businessCap}). Pastikan tab Business sudah disimpan; batas per role mengikuti kolom MH Business per role, bukan hanya Total MH.",
                        ], 422);
                    }
                }

                $requirement->development_mh = $newMh;
                $requirement->save();
            }

            DB::commit();
            return response()->json(['status' => 'success']);
        } catch (\Throwable $e) {
            DB::rollBack();
            return response()->json(['message' => $e->getMessage()], 500);
        }
    }

    public function acknowledgeDevelopment(Request $request, string $id)
    {
        $presale = Presale::with('roleRequirements')->findOrFail($id);
        if (!$presale->business_acknowledged_at) {
            return response()->json(['message' => 'Business harus acknowledge terlebih dahulu.'], 422);
        }

        if ($presale->methodology === 'Agile Scrum') {
            $emptyDevelopmentMh = $presale->roleRequirements->contains(fn ($r) => $r->development_mh === null);
            if ($emptyDevelopmentMh) {
                return response()->json(['message' => 'Semua role harus memiliki MH development sebelum acknowledge.'], 422);
            }
        }

        $presale->update([
            'development_acknowledged_at' => now(),
            'development_acknowledged_by' => $request->user()?->id,
        ]);
        $this->log('Presales', 'Development Acknowledged', "Development acknowledged for {$presale->project_name}");
        return response()->json(['status' => 'success']);
    }

    public function updateOperation(Request $request, string $id)
    {
        $presale = Presale::with('roleRequirements')->findOrFail($id);
        if (!$presale->business_acknowledged_at) {
            return response()->json(['message' => 'Tab Operation aktif setelah Business acknowledge.'], 422);
        }

        $validated = $request->validate([
            'assignments' => 'required|array',
            'assignments.*.project_role_id' => 'required|exists:project_roles,id',
            'assignments.*.user_ids' => 'required|array|min:1',
            'assignments.*.user_ids.*' => 'required|exists:users,id',
        ]);

        $requiredRoleIds = $presale->roleRequirements->pluck('project_role_id')->unique();
        $submittedRoleIds = collect($validated['assignments'])->pluck('project_role_id')->map(fn ($v) => (int) $v)->unique();

        if ($requiredRoleIds->diff($submittedRoleIds)->isNotEmpty()) {
            return response()->json(['message' => 'Semua role dari Business/Development wajib memiliki assignment Operation.'], 422);
        }

        DB::beginTransaction();
        try {
            $presale->operationAssignments()->delete();
            foreach ($validated['assignments'] as $entry) {
                $roleId = (int) $entry['project_role_id'];
                foreach (array_unique($entry['user_ids']) as $userId) {
                    PresaleOperationAssignment::create([
                        'presale_id' => $presale->id,
                        'project_role_id' => $roleId,
                        'user_id' => $userId,
                    ]);
                }
            }

            DB::commit();
            return response()->json(['status' => 'success']);
        } catch (\Throwable $e) {
            DB::rollBack();
            return response()->json(['message' => $e->getMessage()], 500);
        }
    }

    public function acknowledgeOperation(Request $request, string $id)
    {
        $presale = Presale::with('roleRequirements', 'operationAssignments')->findOrFail($id);
        if (!$presale->business_acknowledged_at) {
            return response()->json(['message' => 'Business harus acknowledge terlebih dahulu.'], 422);
        }

        $requiredRoleIds = $presale->roleRequirements->pluck('project_role_id')->unique();
        $assignedRoleIds = $presale->operationAssignments->pluck('project_role_id')->unique();
        if ($requiredRoleIds->diff($assignedRoleIds)->isNotEmpty()) {
            return response()->json(['message' => 'Assignment operation belum lengkap.'], 422);
        }

        $presale->update([
            'operation_acknowledged_at' => now(),
            'operation_acknowledged_by' => $request->user()?->id,
        ]);
        $this->log('Presales', 'Operation Acknowledged', "Operation acknowledged for {$presale->project_name}");
        return response()->json(['status' => 'success']);
    }

    public function proceedToProject(Request $request, string $id)
    {
        $presale = Presale::with(['roleRequirements', 'operationAssignments'])->findOrFail($id);
        if (!$presale->business_acknowledged_at || !$presale->operation_acknowledged_at) {
            return response()->json(['message' => 'Business dan Operation harus acknowledged sebelum proceed project.'], 422);
        }

        if ($presale->converted_project_id) {
            return response()->json([
                'project_id' => $presale->converted_project_id,
                'message' => 'Opportunity sudah pernah diproses menjadi project.',
            ]);
        }

        DB::beginTransaction();
        try {
            $project = Project::create([
                'name' => $presale->project_name ?: $presale->name,
                'status' => 'Planning',
                'budget_status' => 'On Budget',
                'completion' => 0,
                'methodology' => $presale->methodology ?: 'Agile Scrum',
                'start_date' => null,
                'end_date' => null,
                'total_manhours' => $presale->methodology === 'Agile Scrum' ? $presale->total_manhours : null,
                'hourly_rate' => null,
                'total_cost' => null,
                'quotation_value' => $presale->estimated_budget ?: $presale->quotation_value ?: $presale->estimated_value,
            ]);

            foreach ($presale->roleRequirements as $requirement) {
                ProjectRoleQuota::create([
                    'project_id' => $project->id,
                    'project_role_id' => $requirement->project_role_id,
                    'quota_hours' => $requirement->development_mh ?? $requirement->business_mh ?? 0,
                ]);
            }

            foreach ($presale->operationAssignments as $assignment) {
                ProjectMember::firstOrCreate([
                    'project_id' => $project->id,
                    'user_id' => $assignment->user_id,
                    'project_role_id' => $assignment->project_role_id,
                ]);
            }

            $presale->update([
                'status' => 'Won',
                'converted_at' => now(),
                'converted_project_id' => $project->id,
            ]);

            DB::commit();

            $this->log('Presales', 'Proceeded To Project', "Opportunity {$presale->project_name} converted to project {$project->name}");
            return response()->json([
                'project_id' => $project->id,
                'message' => 'Opportunity berhasil diproses ke Project Board.',
            ]);
        } catch (\Throwable $e) {
            DB::rollBack();
            return response()->json(['message' => $e->getMessage()], 500);
        }
    }

    public function update(Request $request, string $id)
    {
        $presale = Presale::findOrFail($id);
        $oldStatus = $presale->status;

        $validated = $request->validate([
            'company_id' => 'sometimes|nullable|exists:companies,id',
            'project_name' => 'sometimes|string|max:255',
            'project_category_id' => 'sometimes|nullable|exists:project_categories,id',
            'estimated_budget' => 'sometimes|nullable|numeric|min:0',
            'project_description' => 'sometimes|nullable|string',
            'name' => 'sometimes|string|max:255',
            'estimated_value' => 'sometimes|nullable|numeric|min:0',
            'description' => 'sometimes|nullable|string',
            'status' => 'sometimes|string|max:100',
            'sales_pitch_id' => 'sometimes|nullable',
        ]);

        if (isset($validated['project_name']) && !isset($validated['name'])) {
            $validated['name'] = $validated['project_name'];
        }
        if (isset($validated['estimated_budget']) && !isset($validated['estimated_value'])) {
            $validated['estimated_value'] = $validated['estimated_budget'];
        }
        if (isset($validated['project_description']) && !isset($validated['description'])) {
            $validated['description'] = $validated['project_description'];
        }

        $changes = $presale->update($validated) ? 1 : 0;

        if (isset($validated['status']) && $validated['status'] !== $oldStatus) {
            $this->log('Presales', 'Updated Pipeline Status', "Moved '{$presale->name}' from {$oldStatus} to {$validated['status']}");
        } else {
            $this->log('Presales', 'Updated Lead Details', "Modified data for '{$presale->name}'");
        }

        return response()->json(['changes' => $changes]);
    }

    public function destroy(string $id)
    {
        $presale = Presale::find($id);
        if ($presale) {
            $this->log('Presales', 'Deleted Lead', "Permanently removed lead: {$presale->name}");
            $deleted = $presale->delete();
        } else {
            $deleted = 0;
        }
        return response()->json(['deleted' => $deleted]);
    }
}
