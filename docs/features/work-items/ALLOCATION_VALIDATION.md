# Sprint & Member Allocation Validation Rules

This document outlines the validation rules, capacity calculations, and logging mechanisms for sprint and member story point allocations.

---

## 1. Capacity Calculations

### 1.1 Team Member Capacity

A team member's capacity for a project is their **effective capacity** calculated across all active teams (`status = 'active'`) on that project.

- For a single team:
  $$\text{Effective Capacity} = \text{capacity} \times \left( \frac{\text{allocation}}{100} \right)$$
- If `capacity` is not set (`NULL`), it defaults to **40** story points.
- If `allocation` is not set (`NULL`), it defaults to **100** (representing 100% allocation).
- If the user belongs to multiple teams for the project, their project capacity is the sum of their effective capacities across all those teams.
- If the user is not a member of any active team for the project, their capacity is **0** story points.

### 1.2 Sprint Capacity

A sprint's capacity is the sum of the effective capacities of all active team members across all active teams associated with the sprint's project.

- If a project has no active team members with configured capacity (or no teams exist), sprint capacity checks are **bypassed** (considered unlimited).
- If at least one active team member exists with a capacity configuration, the sprint capacity limit is strictly enforced.

---

## 2. Validation Checks & Scenarios

Every time a work item is **created** or **updated** with a non-null `sprint_id`, the system validates the allocation limits.

### 2.1 Sprint Allocation Validation

The total story points allocated to the target sprint must not exceed the sprint capacity:
$$\sum \text{story\_points}_{\text{active items in sprint}} \le \text{Sprint Capacity}$$

- **When story points exceed sprint capacity:** The creation/update is blocked. The API returns a `400 Bad Request` containing a `WorkItemValidationError` with the message:
  `Sprint capacity exceeded. Sprint capacity is X story points, but the sprint would have Y story points allocated.`

### 2.2 Member Allocation Validation

If the work item has an assignee (`assignee_id`), the total story points assigned to that member within the target sprint must not exceed their capacity:
$$\sum \text{story\_points}_{\text{active items assigned to member in sprint}} \le \text{Member Capacity}$$

- **When story points exceed member capacity:** The creation/update is blocked. The API returns a `400 Bad Request` containing a `WorkItemValidationError` with the message:
  `Member capacity exceeded in this sprint. Assignee Name has a capacity of X story points, but would have Y story points assigned.`

---

## 3. Work-Item Allocation Change Logs

All successful changes to allocation fields (`sprint_id`, `assignee_id`, or `story_points`) are logged automatically in the `work_item_worklogs` table:

- `logged_hours` is set to `0`.
- `comment` contains a detailed explanation of the change, recording the old and new values.
- Example: `"Allocation changed: sprint_id set to 'Sprint A' (was: Backlog), assignee_id set to 'John Doe' (was: Unassigned), story_points set to 8 (was: 5)."`

---

## 4. Guest & Project Isolation

Guest access is locked down using the following restrictions:

- **User Existence:** An active exact `email` allowlist entry must match a user in the `users` table.
- **Project Membership:** The guest user must have at least **1 active membership** in the `project_members` table to access any protected area of the application.
- **Access Control List (ACL):** If `allowed_project_ids` (configured as Allowed Project Keys in the UI allowlist form) is defined on their allowlist record, they are restricted to accessing _only_ those specific projects. The backend resolves these configured project keys into their internal UUIDs, filtering the guest's workspace project list and permissions.

---

## 5. Testing Guide

Use the following step-by-step test cases to verify the correctness of the allocation validation and guest isolation behaviors.

### Scenario A: Sprint Capacity Enforcement

**Objective**: Verify that adding tasks to a sprint beyond its total member capacity is blocked.

1. **Setup**:
   - Create a project (e.g. `SG`) and define an active team (e.g. `SG DEV`).
   - Add one active team member (e.g. `Sandeepa`) with capacity = `30` in the team workspace.
   - Create a sprint for this project (e.g. `SG SPRINT 1`). The sprint capacity will resolve to `30`.
2. **Action**:
   - Create a work item with `30` story points in the backlog.
   - Drag or update this work item to assign it to `SG SPRINT 1`. (This should succeed).
   - Create another work item with `10` story points in the backlog.
   - Attempt to drag or assign this second item to `SG SPRINT 1`.
3. **Expected Result**:
   - The action is blocked.
   - A modal pop-up error dialog (matching the project delete format) is displayed to the user with the message:
     > [!WARNING]
     > `Sprint capacity exceeded. Sprint capacity is 30 story points, but the sprint would have 40 story points allocated.`

---

### Scenario B: Member Capacity Enforcement

**Objective**: Verify that assigning tasks to a specific member beyond their individual capacity is blocked even when the sprint has remaining capacity.

1. **Setup**:
   - In the team workspace, add two active team members:
     - Member A (e.g. `Sandeepa`) with capacity = `30`.
     - Member B (e.g. `Carol`) with capacity = `40`.
   - The total sprint capacity resolves to `70` (`30 + 40`).
2. **Action**:
   - Assign a work item with `20` story points in `SG SPRINT 1` to Member A. (This should succeed).
   - Create another work item in the backlog with `15` story points.
   - Attempt to assign this second item to Member A and assign it to `SG SPRINT 1`.
3. **Expected Result**:
   - The action is blocked (even though the total sprint points `35` is well below the sprint capacity of `70`).
   - A modal pop-up error dialog is displayed to the user with the message:
     > [!WARNING]
     > `Member capacity exceeded in this sprint. Sandeepa has a capacity of 30 story points, but would have 35 story points assigned.`

---

### Scenario C: Allocation Change Logs

**Objective**: Verify that successful adjustments to sprints, assignees, or story points automatically create log worklogs.

1. **Action**:
   - Select an existing work item.
   - Change its sprint from `Backlog` to `SG SPRINT 1`.
   - Change its assignee to `Sandeepa`.
   - Change its story points from `5` to `8`.
2. **Expected Result**:
   - The changes are saved successfully.
   - Navigate to the work item logs database/view.
   - A worklog row exists with `logged_hours = 0` and a comment resembling:
     `"Allocation changed: sprint_id set to 'SG SPRINT 1' (was: Backlog), assignee_id set to 'Sandeepa' (was: Unassigned), story_points set to 8 (was: 5)."`

---

### Scenario D: Guest Project Isolation (ACL Keys)

**Objective**: Verify guest users are strictly isolated to projects matching their configured allowlist ACL keys.

1. **Setup**:
   - Log in as an administrator.
   - Navigate to **System Settings > Users > Allowlist** (`/users?tab=allowlist`).
   - Add or edit the allowlist entry for a user (e.g. `tashila.kumara@1billiontech.com`).
   - In the **Allowed Project Keys (optional, comma-separated)** field, enter `SG`.
   - Add `tashila.kumara@1billiontech.com` as a member to two projects in the database: `SG` (key: `SG`) and `NarrowURL` (key: `NU`).
2. **Action**:
   - Log in as `tashila.kumara@1billiontech.com`.
   - Navigate to the projects registry page (`/projects`).
3. **Expected Result**:
   - The user **only sees the SG project** in the projects registry.
   - The `NarrowURL` project is completely hidden.
   - Any manual URL navigation to `/projects/NarrowURL-ID` is denied with an authorization error.
