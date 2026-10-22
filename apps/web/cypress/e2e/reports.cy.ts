import type {
  DailyReportAiInsights,
  GenerateReportResponse,
} from '@repo/types/api/v1';

const AI_UNAVAILABLE_MESSAGE =
  'AI insights are unavailable right now. Your regular report was generated successfully.';

const regularReport = {
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
} satisfies GenerateReportResponse;

const aiInsights = {
  completedWork: ['The report preview was completed.'],
  importantInProgress: ['Two assigned items remain in progress.'],
  pendingTasks: ['Three assigned tasks remain pending.'],
  blockedAndOverdue: ['One assigned task is blocked.'],
  potentialRisks: ['Four overdue items may affect delivery.'],
  upcomingDeadlines: ['Two deadlines are approaching.'],
  nextPriorities: ['Resolve the blocked task first.'],
  overallProgress: 'The selected assigned work is progressing with risk.',
} satisfies DailyReportAiInsights;

const generatedAiReport = {
  ...regularReport,
  markdown: `${regularReport.markdown}\n\n## AI Insights\n\n### Overall Progress\n\n${aiInsights.overallProgress}`,
  aiInsightsStatus: 'generated',
  aiInsights,
} satisfies GenerateReportResponse;

const unavailableAiReport = {
  ...regularReport,
  aiInsightsStatus: 'unavailable',
} satisfies GenerateReportResponse;

function visitReports(): void {
  cy.visit('/reports?date=2026-10-20&timezone=UTC&verbosity=detailed');
}

function generateButton(): Cypress.Chainable<JQuery<HTMLButtonElement>> {
  return cy.contains('button', 'Generate report');
}

function aiCheckbox(): Cypress.Chainable<JQuery<HTMLElement>> {
  return cy.get('#include-ai-insights');
}

function assertMetric(label: string, value: number): void {
  cy.contains('dt', label)
    .should('be.visible')
    .siblings('dd')
    .should('have.text', String(value));
}

function assertOneAiInsightsHeading(): void {
  cy.get('h2').then(($headings) => {
    const matching = [...$headings].filter(
      (heading) => heading.textContent?.trim() === 'AI Insights'
    );
    expect(matching).to.have.length(1);
  });
}

describe('Daily Reports', () => {
  beforeEach(() => cy.login());

  it('loads existing filters and generates a regular report without AI', () => {
    let generateCalls = 0;
    cy.intercept('POST', '**/api/v1/reports/generate', (request) => {
      generateCalls += 1;
      request.reply({ data: regularReport });
    }).as('generateRegularReport');

    visitReports();

    cy.contains('h1', 'Daily Report').should('be.visible');
    cy.contains('Report configuration').should('be.visible');
    cy.get('#report-date').should('have.value', '2026-10-20');
    cy.get('#report-timezone').should('have.value', 'UTC');
    cy.get('#report-verbosity').should('have.value', 'detailed');
    cy.contains('legend', 'Projects').should('be.visible');
    cy.contains('legend', 'Sprints').should('be.visible');
    aiCheckbox().should('have.attr', 'aria-checked', 'false');
    cy.contains(
      'Use AI to explain progress, risks, and suggested next priorities.'
    ).should('be.visible');
    cy.contains('Configure your report').should('be.visible');
    cy.then(() => expect(generateCalls).to.equal(0));

    generateButton().click();
    cy.wait('@generateRegularReport').its('request.body').should('deep.equal', {
      reportType: 'daily',
      reportDate: '2026-10-20',
      timezone: 'UTC',
      verbosity: 'detailed',
      includeAiInsights: false,
    });

    assertMetric('Completed', 1);
    assertMetric('In progress', 2);
    cy.contains('Ship the report preview').should('be.visible');
    cy.contains(AI_UNAVAILABLE_MESSAGE).should('not.exist');
    cy.contains('button', 'Download Markdown').should('be.enabled').click();
    cy.contains('current work-item state').should('be.visible');
  });

  it('requests AI insights while preserving selected report filters', () => {
    let generateCalls = 0;
    let projectId = '';
    let sprintId = '';
    cy.intercept('POST', '**/api/v1/reports/generate', (request) => {
      generateCalls += 1;
      request.reply({ data: generatedAiReport });
    }).as('generateAiReport');

    visitReports();

    cy.contains('legend', 'Projects')
      .parent('fieldset')
      .find('[role="checkbox"]')
      .first()
      .should('be.visible')
      .then(($checkbox) => {
        projectId = $checkbox.attr('id')!.replace('Projects-', '');
        cy.wrap($checkbox).click();
      });
    cy.contains('legend', 'Sprints')
      .parent('fieldset')
      .find('[role="checkbox"]')
      .first()
      .should('be.visible')
      .then(($checkbox) => {
        sprintId = $checkbox.attr('id')!.replace('Sprints-', '');
        cy.wrap($checkbox).click();
      });
    aiCheckbox().click().should('have.attr', 'aria-checked', 'true');
    cy.then(() => expect(generateCalls).to.equal(0));

    generateButton().click();
    cy.wait('@generateAiReport').then(({ request }) => {
      expect(request.body).to.deep.equal({
        reportType: 'daily',
        reportDate: '2026-10-20',
        timezone: 'UTC',
        verbosity: 'detailed',
        projectIds: [projectId],
        sprintIds: [sprintId],
        includeAiInsights: true,
      });
    });

    assertMetric('Completed', 1);
    assertMetric('Overdue', 4);
    cy.contains('Ship the report preview').should('be.visible');
    cy.contains(aiInsights.overallProgress).should('be.visible');
    assertOneAiInsightsHeading();
    cy.contains(AI_UNAVAILABLE_MESSAGE).should('not.exist');
    cy.contains('button', 'Download Markdown').should('be.enabled').click();
  });

  it('keeps the regular report usable when AI insights are unavailable', () => {
    cy.intercept('POST', '**/api/v1/reports/generate', {
      body: { data: unavailableAiReport },
    }).as('generateUnavailableReport');

    visitReports();
    aiCheckbox().click().should('have.attr', 'aria-checked', 'true');
    generateButton().click();

    cy.wait('@generateUnavailableReport')
      .its('request.body.includeAiInsights')
      .should('equal', true);
    cy.get('[role="status"]')
      .should('be.visible')
      .and('contain.text', AI_UNAVAILABLE_MESSAGE);
    assertMetric('Completed', 1);
    cy.contains('Ship the report preview').should('be.visible');
    cy.contains('h2', 'AI Insights').should('not.exist');
    cy.get('[role="alert"]').should('not.exist');
    cy.contains('button', 'Download Markdown').should('be.enabled').click();
  });

  it('shows loading, blocks duplicate submissions, and recovers after success', () => {
    let generateCalls = 0;
    cy.intercept('POST', '**/api/v1/reports/generate', (request) => {
      generateCalls += 1;
      request.reply({ delay: 300, body: { data: generatedAiReport } });
    }).as('delayedReport');

    visitReports();
    aiCheckbox().click();
    cy.then(() => expect(generateCalls).to.equal(0));
    generateButton().click();

    cy.get('button[aria-label="Generating report"]')
      .should('be.disabled')
      .closest('form')
      .submit();
    cy.wait('@delayedReport');
    cy.then(() => expect(generateCalls).to.equal(1));
    generateButton().should('be.enabled');
    assertOneAiInsightsHeading();
  });

  it('clears loading and keeps existing API error handling after failure', () => {
    cy.intercept('POST', '**/api/v1/reports/generate', (request) => {
      request.reply({
        statusCode: 500,
        delay: 200,
        body: { error: 'The report could not be generated.' },
      });
    }).as('failedReport');

    visitReports();
    generateButton().click();
    cy.get('button[aria-label="Generating report"]').should('be.disabled');
    cy.wait('@failedReport');

    cy.get('[role="alert"]')
      .should('be.visible')
      .and('contain.text', 'The report could not be generated.');
    generateButton().should('be.enabled');
  });

  it('binds warnings to the displayed response across checkbox changes', () => {
    let generateCalls = 0;
    cy.intercept('POST', '**/api/v1/reports/generate', (request) => {
      generateCalls += 1;
      request.reply({
        data: generateCalls === 1 ? unavailableAiReport : generatedAiReport,
      });
    }).as('transitionReport');

    visitReports();
    aiCheckbox().click();
    generateButton().click();
    cy.wait('@transitionReport');
    cy.get('[role="status"]').should('contain.text', AI_UNAVAILABLE_MESSAGE);

    aiCheckbox().click().should('have.attr', 'aria-checked', 'false');
    cy.get('[role="status"]').should('contain.text', AI_UNAVAILABLE_MESSAGE);
    aiCheckbox().click().should('have.attr', 'aria-checked', 'true');
    cy.then(() => expect(generateCalls).to.equal(1));

    generateButton().click();
    cy.wait('@transitionReport');
    cy.get('[role="status"]').should('not.exist');
    assertOneAiInsightsHeading();
    cy.contains(aiInsights.overallProgress).should('be.visible');
  });

  it('preserves the existing forbidden response message', () => {
    cy.intercept('POST', '**/api/v1/reports/generate', {
      statusCode: 403,
      body: { error: 'Forbidden' },
    }).as('forbiddenReport');

    visitReports();
    generateButton().click();
    cy.wait('@forbiddenReport');

    cy.get('[role="alert"]')
      .should('be.visible')
      .and(
        'contain.text',
        'You do not have access to one or more selected projects or sprints.'
      );
    cy.contains('Ship the report preview').should('not.exist');
  });
});
