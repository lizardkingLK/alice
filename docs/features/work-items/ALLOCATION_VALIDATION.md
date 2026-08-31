# Sprint & Member Allocation Validation Rules

This document outlines the validation rules, capacity calculations, and logging mechanisms for sprint and member story point allocations.

---

## 1. Capacity Calculations

### 1.1 Team Member Capacity
A team member's capacity for a project is their **effective capacity** calculated across all active teams (`status = 'active'`) on that project.
* For a single team:
  $$\text{Effective Capacity} = \text{capacity} \times \left( \frac{\text{allocation}}{100} \right)$$
* If `capacity` is not set (`NULL`), it defaults to **40** story points.
* If `allocation` is not set (`NULL`), it defaults to **100** (representing 100% allocation).
* If the user belongs to multiple teams for the project, their project capacity is the sum of their effective capacities across all those teams.
* If the user is not a member of any active team for the project, their capacity is **0** story points.

### 1.2 Sprint Capacity
A sprint's capacity is the sum of the effective capacities of all active team members across all active teams associated with the sprint's project.
* If a project has no active team members with configured capacity (or no teams exist), sprint capacity checks are **bypassed** (considered unlimited).
* If at least one active team member exists with a capacity configuration, the sprint capacity limit is strictly enforced.

---

## 2. Validation Checks & Scenarios

Every time a work item is **created** or **updated** with a non-null `sprint_id`, the system validates the allocation limits.

### 2.1 Sprint Allocation Validation
The total story points allocated to the target sprint must not exceed the sprint capacity:
$$\sum \text{story\_points}_{\text{active items in sprint}} \le \text{Sprint Capacity}$$
* **When story points exceed sprint capacity:** The creation/update is blocked. The API returns a `400 Bad Request` containing a `WorkItemValidationError` with the message:
  `Sprint capacity exceeded. Sprint capacity is X story points, but the sprint would have Y story points allocated.`

### 2.2 Member Allocation Validation
If the work item has an assignee (`assignee_id`), the total story points assigned to that member within the target sprint must not exceed their capacity:
$$\sum \text{story\_points}_{\text{active items assigned to member in sprint}} \le \text{Member Capacity}$$
* **When story points exceed member capacity:** The creation/update is blocked. The API returns a `400 Bad Request` containing a `WorkItemValidationError` with the message:
  `Member capacity exceeded in this sprint. Assignee Name has a capacity of X story points, but would have Y story points assigned.`

---

## 3. Work-Item Allocation Change Logs

All successful changes to allocation fields (`sprint_id`, `assignee_id`, or `story_points`) are logged automatically in the `work_item_worklogs` table:
* `logged_hours` is set to `0`.
* `comment` contains a detailed explanation of the change, recording the old and new values.
* Example: `"Allocation changed: sprint_id set to 'Sprint A' (was: Backlog), assignee_id set to 'John Doe' (was: Unassigned), story_points set to 8 (was: 5)."`

---

## 4. Guest & Project Isolation

Guest access is locked down using the following restrictions:
* **User Existence:** An active exact `email` allowlist entry must match a user in the `users` table.
* **Project Membership:** The guest user must have at least **1 active membership** in the `project_members` table to access any protected area of the application.
* **Access Control List (ACL):** If `allowed_project_ids` is configured on their allowlist record, they are restricted to accessing *only* those specific projects. Their accessible project queries will intersect their memberships with this ACL list.
