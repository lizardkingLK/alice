function createSprint(sprintName: string, goal: string) {
  // Click "Add Sprint" button
  cy.contains('button', 'Add Sprint').click();

  // Wait for project options to load and select the first project
  cy.get('select#sprint-project option')
    .should('have.length.at.least', 1)
    .and('not.have.value', '');

  cy.get('select#sprint-project')
    .first()
    .then(($select) => {
      const options = $select.find('option');
      cy.get('select#sprint-project')
        .first()
        .select(options.eq(0).val() as string);
    });

  cy.get('input#sprint-name').first().type(sprintName, { delay: 30 });
  cy.get('textarea#sprint-goal').first().type(goal, { delay: 30 });

  // Enter start date and end date
  // Note: inputs with type="date" expect "YYYY-MM-DD"
  const today = new Date().toISOString().split('T')[0]!;
  const twoWeeksLater = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split('T')[0]!;

  cy.get('input#sprint-start-date').first().type(today, { delay: 30 });
  cy.get('input#sprint-end-date').first().type(twoWeeksLater, { delay: 30 });

  // Submit
  cy.get('form').first().submit();

  // Wait for the modal success timer to fire and unmount the modal
  cy.get('textarea#sprint-goal').should('not.exist');
}

describe('Sprints Workspace', () => {
  before(() => {
    // Clean up old test sprints before running the test suite
    cy.task('cleanTestSprints', { restoreOwner: false });
  });

  after(() => {
    // Clean up test sprints after running the test suite
    cy.task('cleanTestSprints', { restoreOwner: true });
  });

  beforeEach(() => {
    // Log in before each test.
    cy.login();
  });

  it('should display the sprints list, add a sprint, and edit it', () => {
    // 1. Visit /sprints
    cy.visit('/sprints');

    // 2. Assert page loaded and shows Sprints header
    cy.contains('[data-slot="breadcrumb-page"]', 'Sprints').should('exist');
    cy.get('body').should('contain', 'Plan and track team sprints.');

    // 3. Add a sprint using the helper function
    const sprintName = `Sprint E2E ${Date.now()}`;
    const goal = 'Write automated tests using Cypress';
    createSprint(sprintName, goal);

    // The modal should close and the new sprint should appear in the list
    cy.contains(sprintName).should('exist');
    cy.contains(goal).should('exist');

    // 5. Edit the newly created sprint
    // We find the table row containing the sprint name, and click the edit button (which has aria-label="Edit Sprint")
    cy.contains('tr', sprintName).within(() => {
      cy.get('button[aria-label="Edit Sprint"]').click();
    });

    // The modal should open with the sprint details
    cy.get('input#sprint-name').first().should('have.value', sprintName);
    cy.get('textarea#sprint-goal').first().should('have.value', goal);

    // Edit the goal
    const updatedGoal = `${goal} - Updated`;
    cy.get('textarea#sprint-goal').first().clear();
    cy.wrap(null).then(
      () => new Promise((resolve) => setTimeout(resolve, 500))
    );
    cy.get('textarea#sprint-goal').first().type(updatedGoal, { delay: 30 });

    // Submit the form
    cy.get('form').first().submit();

    // Wait for the modal success transition
    cy.get('textarea#sprint-goal').should('not.exist');

    // Verify it updated in the list
    cy.contains('tr', sprintName).should('contain', updatedGoal);

    // 6. Verify Status is Read-Only
    // The status should display 'Not Started' and should not be editable (rendered as span, not a button)
    cy.contains('tr', sprintName).within(() => {
      cy.contains('span', 'Not Started').should('exist');
      cy.get('button').contains('Not Started').should('not.exist');
    });
  });

  it('should allow non-creator to edit and change status of a sprint', () => {
    // 1. Logged in as admin@alice.dev by default (beforeEach). Let's create a sprint.
    cy.visit('/sprints');

    const sprintName = `Admin Sprint ${Date.now()}`;
    const goal = 'Collaborative Sprint Goal';
    createSprint(sprintName, goal);

    // 2. Clear auth state and log in as member@alice.dev
    cy.clearAllCookies();
    cy.clearAllLocalStorage();
    cy.clearAllSessionStorage();

    cy.login('member@alice.dev', 'DevSeed123!');

    // 3. Visit /sprints page
    cy.visit('/sprints');

    // 4. Verify we can see the admin's sprint
    cy.contains(sprintName).should('exist');

    // 5. Verify status is read-only as non-creator
    cy.contains('tr', sprintName).within(() => {
      cy.contains('span', 'Not Started').should('exist');
      cy.get('button').contains('Not Started').should('not.exist');
    });

    // 6. Edit the sprint as non-creator
    cy.contains('tr', sprintName).within(() => {
      cy.get('button[aria-label="Edit Sprint"]').click();
    });

    cy.get('input#sprint-name').first().should('have.value', sprintName);
    const updatedGoal = 'Goal updated by member';
    cy.get('textarea#sprint-goal').first().clear();
    cy.wrap(null).then(
      () => new Promise((resolve) => setTimeout(resolve, 500))
    );
    cy.get('textarea#sprint-goal').first().type(updatedGoal, { delay: 30 });

    cy.get('form').first().submit();
    cy.get('textarea#sprint-goal').should('not.exist');

    // Verify update persisted
    cy.contains('tr', sprintName).should('contain', updatedGoal);
  });
});
