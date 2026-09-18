# User Testing Guide: Unified Role-Based Project Access (Registry & Chat)

Step-by-step instructions for testing role-based project access validation across the **Project Registry View** (`/projects`) and **Alice Chat**.

**Audience:** Members, Managers, Administrators, and QA Engineers

---

## Prerequisites & Environment Setup

1. **API Backend Server** running on `http://localhost:5000`:
   ```bash
   pnpm --filter api dev
   ```
2. **Web Frontend Server** running on `http://localhost:3000`:
   ```bash
   pnpm --filter web dev
   ```
3. **Workspace Data**: Ensure at least 3 active projects exist (e.g. `Alpha`, `Beta`, `Gamma`).

---

## Test Scenarios

### Scenario 1: Member Signed In with $n$ Assigned Projects ($n < N$)

**Goal**: Verify that a Member only sees assigned projects in the Project Registry and in Alice Chat.

1. **Setup**:
   - Sign in as an **Administrator**.
   - Navigate to `/projects` -> select **Alpha**.
   - In **Members** tab, add your test Member user (e.g. `member@alice.local`).
   - Ensure the Member user is **not** assigned to **Beta** or **Gamma**.
   - Sign out, and sign in as `member@alice.local`.
2. **Test Project Registry (`/projects`)**:
   - Navigate to **Projects** in the sidebar.
   - **Verification**:
     - Only **Alpha** is visible in the table.
     - **Beta** and **Gamma** are not present.
     - The **+ Add Project** button is **hidden**.
     - No row action dropdown (Edit/Archive/Purge) is displayed.
3. **Test Alice Chat AI Agent**:
   - Open **Alice** from the sidebar (`/chat`) or click the Alice header drawer.
   - Send the prompt:
     ```text
     show all projects
     ```
   - **Verification**:
     - Alice must introduce the response with:
       ```text
       Here are all the projects that are available to you:
       ```
     - Alice outputs a Markdown table:
       | Project Name | Key | Description |
       | ------------ | --- | ----------- |
       | Alpha        | ALP | ...         |
     - **Beta** and **Gamma** are **NOT** shown in the table.
     - Alice does not mention or leak any data about **Beta** or **Gamma**.

---

### Scenario 2: Member with Zero Assigned Projects ($n = 0$)

**Goal**: Verify proper handling when a user has no project memberships.

1. **Setup**:
   - Sign in as a Member user who has no project assignments.
2. **Test Project Registry (`/projects`)**:
   - Navigate to `/projects`.
   - **Verification**: Table shows empty state ("No projects found").
3. **Test Alice Chat**:
   - In chat, ask:
     ```text
     list down all the projects
     ```
   - **Verification**:
     - Alice states clearly:
       > _"You do not currently have access to any projects. Please contact your workspace administrator to request access."_
     - No table is generated and no unauthorized projects appear.

---

### Scenario 3: Manager Role

**Goal**: Verify that Managers see assigned/owned projects, have management controls, and cannot purge or create.

1. **Setup**:
   - Sign in as a user with the **Manager** role who is assigned to **Alpha** and **Beta**.
2. **Test Project Registry (`/projects`)**:
   - Navigate to `/projects`.
   - **Verification**:
     - **Alpha** and **Beta** are displayed; **Gamma** is hidden.
     - **+ Add Project** button is **hidden** (admin only).
     - Row action dropdown is available: **Edit** and **Archive** are shown.
     - In **Archived** tab: **Restore** is available; **Purge** (permanent delete) is **hidden**.
3. **Test Alice Chat**:
   - Ask Alice:
     ```text
     list all projects
     ```
   - **Verification**:
     - Alice responds with: _"Here are all the projects that are available to you:"_
     - Table lists **Alpha** and **Beta** with Name, Key, and Description.

---

### Scenario 4: Administrator Role

**Goal**: Verify that Administrators have full visibility and administrative controls.

1. **Setup**:
   - Sign in as an **Administrator**.
2. **Test Project Registry (`/projects`)**:
   - Navigate to `/projects`.
   - **Verification**:
     - All workspace projects (**Alpha**, **Beta**, **Gamma**) are displayed.
     - **+ Add Project** button is **visible**.
     - Full row actions (Edit, Archive, Restore, Purge) are available.
3. **Test Alice Chat**:
   - Ask Alice:
     ```text
     show all projects
     ```
   - **Verification**:
     - Alice introduces with: _"Here are all the projects that are available to you:"_
     - Table contains all workspace projects.

---

## Summary Checklist

| #   | Test Scenario          | Expected Outcome                                                                                    | Pass/Fail |
| --- | ---------------------- | --------------------------------------------------------------------------------------------------- | :-------: |
| 1   | Member Registry View   | Shows only assigned projects; Add Project and row actions hidden                                    |    [ ]    |
| 2   | Member Alice Chat      | Returns only assigned projects under _"Here are all the projects that are available to you:"_ table |    [ ]    |
| 3   | Member with 0 projects | Clean empty state in registry; informative no-access message in chat                                |    [ ]    |
| 4   | Manager Registry View  | Shows assigned/owned projects; Edit/Archive available; Add & Purge hidden                           |    [ ]    |
| 5   | Manager Alice Chat     | Lists assigned/owned projects in Markdown table                                                     |    [ ]    |
| 6   | Admin Registry View    | Shows all projects; Add Project and Purge available                                                 |    [ ]    |
| 7   | Admin Alice Chat       | Lists all workspace projects in Markdown table                                                      |    [ ]    |
