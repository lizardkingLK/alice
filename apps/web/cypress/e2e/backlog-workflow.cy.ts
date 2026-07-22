// Prevent ResizeObserver errors from failing the tests
Cypress.on('uncaught:exception', (err) => {
  return !err.message.includes('ResizeObserver');
});

function createSprintFromBacklog(sprintName: string, goal: string) {
  // Click "Create Sprint" button
  cy.contains('button', 'Create Sprint').click();

  // Wait for the select trigger to be visible and click it
  cy.get('button#sprint-project').should('be.visible').click();

  // Select the AlicePlatform project explicitly to align with the work item project
  cy.get('[role="option"]').contains('AlicePlatform').should('be.visible').click();

  cy.get('input#sprint-name').first().type(sprintName, { delay: 30 });
  cy.get('textarea#sprint-goal').first().type(goal, { delay: 30 });

  // Enter start date and end date
  const today = new Date().toISOString().split('T')[0]!;
  const twoWeeksLater = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split('T')[0]!;

  cy.get('input#sprint-start-date').first().type(today, { delay: 30 });
  cy.get('input#sprint-end-date').first().type(twoWeeksLater, { delay: 30 });

  // Submit
  cy.get('form').first().submit();

  // Wait for API request to finish
  cy.wait('@createSprint');

  // Wait for the modal success timer to fire and unmount the modal
  cy.get('textarea#sprint-goal').should('not.exist');
}

function createWorkItemFromBacklog(title: string) {
  // Click "Create Issue" or "New Issue" button
  cy.contains('button', 'Create Issue').click();

  // Enter title
  cy.get('input#title').first().type(title, { delay: 30 });

  // Select AlicePlatform project explicitly
  cy.get('button#project_id').first().click();
  cy.get('[role="option"]').contains('AlicePlatform').should('be.visible').click();

  // Select type (click trigger and select "Task")
  cy.get('button#type').first().click();
  cy.get('[role="option"]:not([data-disabled])').should('be.visible').contains('Task').click();

  // Enter due date
  const today = new Date().toISOString().split('T')[0]!;
  cy.get('input#due_date').first().type(today, { delay: 30 });

  // Select assignee (click trigger and select first enabled option)
  cy.get('button#assignee_id').first().click();
  cy.get('[role="option"]:not([data-disabled])').should('be.visible').first().click();

  // Submit the form
  cy.get('form').first().submit();

  // Wait for API request to finish
  cy.wait('@createWorkItem');

  // Wait for modal to close
  cy.get('input#title').should('not.exist');
}

describe('Backlog and Sprint E2E Workflow', () => {
  before(() => {
    // Clean up old test data and set ALICE project owner to admin before running the suite
    cy.task('cleanTestSprints', { restoreOwner: false });
  });

  after(() => {
    // Clean up test data and restore ALICE project owner to manager after the suite runs
    cy.task('cleanTestSprints', { restoreOwner: true });
  });

  beforeEach(() => {
    // Log in using environment variables
    cy.login();

    // Intercept API routes
    cy.intercept('POST', '**/api/sprints').as('createSprint');
    cy.intercept('POST', '**/api/workItems').as('createWorkItem');
    cy.intercept('PATCH', '**/api/workItems/*').as('updateWorkItem');
    cy.intercept('PATCH', '**/api/sprints/*/status').as('updateSprintStatus');
  });

  it('should create a sprint, create a work item, assign it, start the sprint, and complete the sprint', () => {
    // 1. Visit /backlog
    cy.visit('/backlog');

    // Assert page loaded and shows Backlog breadcrumb or header
    cy.contains('[data-slot="breadcrumb-page"]', 'Backlog').should('exist');
    cy.get('body').should('contain', 'Plan sprints, prioritize tasks');

    // 2. Create a Sprint directly from the Backlog page
    const sprintName = `Sprint E2E ${Date.now()}`;
    const sprintGoal = 'E2E workflow testing';
    createSprintFromBacklog(sprintName, sprintGoal);

    // Verify it appears in the sprint list on the backlog page
    cy.contains('span', sprintName).should('exist');

    // 3. Create a Work Item from the Backlog page
    const issueTitle = `Issue E2E ${Date.now()}`;
    createWorkItemFromBacklog(issueTitle);

    // Verify it appears under the Backlog section
    cy.contains('span', issueTitle).should('exist');

    // 4. Assign the Work Item to the Sprint using Drag & Drop
    cy.contains('button', issueTitle).as('draggableItem');
    cy.contains('span', sprintName)
      .closest('.overflow-hidden.shadow-sm')
      .children()
      .eq(1)
      .as('dropZone');

    cy.get('@draggableItem').then(($el) => {
      const dataTransfer = new DataTransfer();
      cy.wrap($el).trigger('dragstart', { dataTransfer });
      cy.get('@dropZone').trigger('dragover', { dataTransfer });
      cy.get('@dropZone').trigger('drop', { dataTransfer });
    });

    // Wait for the drag and drop API request to complete to prevent race conditions
    cy.wait('@updateWorkItem');

    // Verify it is assigned to the sprint (appears in the sprint container)
    cy.contains('span', sprintName)
      .closest('.overflow-hidden.shadow-sm')
      .contains('button', issueTitle)
      .should('exist');

    // 5. Start the Sprint
    cy.contains('span', sprintName)
      .closest('.overflow-hidden.shadow-sm')
      .contains('button', 'Start Sprint')
      .click();

    // Confirm starting the sprint
    cy.get('[role="dialog"]').within(() => {
      cy.contains('button', 'Start Sprint').click();
    });

    // Wait for start sprint API response
    cy.wait('@updateSprintStatus');

    cy.get('[role="dialog"]').should('not.exist');

    // Verify status updated and Start button is replaced by Complete Sprint button
    cy.contains('span', sprintName)
      .closest('.overflow-hidden.shadow-sm')
      .contains('button', 'Complete Sprint')
      .should('exist');

    // 6. Complete the Sprint
    // First, mark the work item as "Done" so we are allowed to complete the sprint
    cy.contains('span', sprintName)
      .closest('.overflow-hidden.shadow-sm')
      .contains('button', issueTitle)
      .click();

    // The detail panel sheet should be open. Update status to Done.
    cy.contains('span', 'Status').next('button').click();
    cy.get('[role="option"]').contains('Done').click();

    // Wait for status update API request to finish
    cy.wait('@updateWorkItem');

    // Close the panel by clicking "Save Changes"
    cy.contains('button', 'Save Changes').click();
    cy.get('button:contains("Save Changes")').should('not.exist');

    // Verify status badge in the sprint list displays Done
    cy.contains('span', sprintName)
      .closest('.overflow-hidden.shadow-sm')
      .contains('button', issueTitle)
      .within(() => {
        cy.contains('span', 'Done').should('exist');
      });

    // Complete the sprint
    cy.contains('span', sprintName)
      .closest('.overflow-hidden.shadow-sm')
      .contains('button', 'Complete Sprint')
      .click();

    // Confirm completion
    cy.get('[role="dialog"]').within(() => {
      cy.contains('button', 'Complete Sprint').click();
    });

    // Wait for complete sprint API response
    cy.wait('@updateSprintStatus');

    cy.get('[role="dialog"]').should('not.exist');

    // Verify the sprint is no longer visible under the Active tab
    cy.contains('span', sprintName).should('not.exist');

    // Switch to Completed tab and verify it's listed there
    cy.contains('button', 'Completed').click();
    cy.contains('span', sprintName).should('exist');
  });
});
