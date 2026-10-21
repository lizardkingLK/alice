const generatedReport = {
  snapshot: {
    reportDate: '2026-10-20',
    timezone: 'UTC',
    utcRange: {
      start: '2026-10-20T00:00:00.000Z',
      endExclusive: '2026-10-21T00:00:00.000Z',
    },
    summary: {
      completed: 1,
      inProgress: 2,
      pending: 3,
      blocked: 1,
      dueToday: 1,
      overdue: 4,
      upcomingDeadlines: 2,
    },
    completed: [],
    inProgress: [],
    pending: [],
    blocked: [],
    dueToday: [],
    overdue: [],
    upcomingDeadlines: [],
  },
  markdown: '# Daily Report\n\n## Completed\n\n- Ship the report preview',
  metadata: {
    reportType: 'daily',
    generatedAt: '2026-10-20T12:00:00.000Z',
    reportDate: '2026-10-20',
    timezone: 'UTC',
    verbosity: 'detailed',
    filters: { projectIds: [], sprintIds: [] },
    upcomingDeadlineDays: 7,
  },
};

describe('Daily Reports', () => {
  beforeEach(() => cy.login());

  it('loads URL filters and generates only after submission', () => {
    let generateCalls = 0;
    cy.intercept('POST', '**/api/v1/reports/generate', (request) => {
      generateCalls += 1;
      request.reply({ data: generatedReport });
    }).as('generateReport');

    cy.visit('/reports?date=2026-10-20&timezone=UTC&verbosity=detailed');

    cy.contains('h1', 'Daily Report').should('be.visible');
    cy.get('#report-date').should('have.value', '2026-10-20');
    cy.get('#report-timezone').should('have.value', 'UTC');
    cy.get('#report-verbosity').should('have.value', 'detailed');
    cy.contains('label', 'Report Detail').should('be.visible');
    cy.contains(
      'Choose how much information to include in your report.'
    ).should('be.visible');
    cy.contains('Configure your report').should('be.visible');
    cy.then(() => expect(generateCalls).to.equal(0));

    cy.contains('button', 'Generate report').click();
    cy.wait('@generateReport').its('request.body').should('deep.equal', {
      reportType: 'daily',
      reportDate: '2026-10-20',
      timezone: 'UTC',
      verbosity: 'detailed',
    });

    cy.contains('Ship the report preview').should('be.visible');
    cy.get('[role="group"][aria-label="Completed: 1"]').should('be.visible');
    cy.contains('button', 'Download Markdown').should('be.enabled');
    cy.contains('current work-item state').should('be.visible');
  });
});
