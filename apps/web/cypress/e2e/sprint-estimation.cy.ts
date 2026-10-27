import type {
  SprintEstimationResponse,
  SprintEstimationResult,
} from '@repo/types/api/v1';

Cypress.on('uncaught:exception', (error) => {
  return !error.message.includes('ResizeObserver');
});

const SEEDED_PROJECT_MEMBER_EMAIL = 'member@alice.dev';
const ESTIMATION_PATH = /^\/api\/(?:v1\/)?sprints\/[^/]+\/estimates\/?$/;
const MUTATION_METHODS = ['POST', 'PATCH', 'PUT', 'DELETE'] as const;
const PERSISTENCE_ROUTES = [
  '**/api/sprints',
  '**/api/sprints/**',
  '**/api/v1/sprints',
  '**/api/v1/sprints/**',
  '**/api/work-items',
  '**/api/work-items/**',
  '**/api/v1/work-items',
  '**/api/v1/work-items/**',
] as const;

function getSprintCard(sprintName: string) {
  return cy
    .contains('button', sprintName)
    .closest('[data-slot="card"]')
    .should('exist');
}

function responseEntityId(
  response: { statusCode: number; body: unknown } | undefined,
  entity: string
): string {
  const body = response?.body as { data?: { id?: unknown } } | undefined;
  expect(response?.statusCode, `${entity} response status`).to.be.within(
    200,
    299
  );
  expect(body?.data?.id, `${entity} response id`).to.be.a('string');
  return body!.data!.id as string;
}

function createSprintFromBacklog(
  sprintName: string
): Cypress.Chainable<string> {
  cy.get('button[aria-label="Create"]').click();
  cy.contains('[role="menuitem"]', 'Create Sprint').click();
  cy.get('input#sprint-project').should('be.visible').click();
  cy.contains('[role="option"]', 'AlicePlatform').should('be.visible').click();
  cy.get('input#sprint-name').type(sprintName);
  cy.get('textarea#sprint-goal').type('AI sprint estimation E2E coverage');

  const today = new Date().toISOString().split('T')[0]!;
  const twoWeeksLater = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split('T')[0]!;
  cy.get('input#sprint-start-date').type(today);
  cy.get('input#sprint-end-date').type(twoWeeksLater);
  cy.get('form').first().submit();

  return cy
    .wait('@createSprint')
    .then(({ response }) => responseEntityId(response, 'sprint'))
    .then((sprintId) =>
      cy
        .get('textarea#sprint-goal')
        .should('not.exist')
        .then(() => sprintId)
    );
}

function createSprintWorkItem(
  sprintName: string,
  title: string
): Cypress.Chainable<string> {
  getSprintCard(sprintName)
    .find(`button[aria-label="New work item in ${sprintName}"]`)
    .click();
  cy.get('input#title').should('be.visible').type(title);
  cy.get('button#type').click();
  cy.contains('[role="option"]:not([data-disabled])', 'Task').click();
  cy.get('input#due_date').type(new Date().toISOString().split('T')[0]!);
  cy.get('input#assignee_id').should('not.be.disabled').click();
  cy.get('[role="option"]:not([data-disabled])').first().click();
  cy.get('[role="dialog"] form').submit();

  return cy
    .wait('@createWorkItem')
    .then(({ response }) => responseEntityId(response, 'work item'))
    .then((workItemId) =>
      cy
        .get('input#title')
        .should('not.exist')
        .then(() => workItemId)
    );
}

function openEstimationDialog(sprintName: string): void {
  getSprintCard(sprintName)
    .find('button[aria-label="Open Actions Menu"]')
    .click();
  cy.get('[role="menuitem"][aria-label="Estimate with AI"]').click();
  cy.get('[role="dialog"]')
    .should('be.visible')
    .and('contain.text', `Estimate ${sprintName}`);
}

function loginAsSeededProjectMember(): void {
  cy.env(['TEST_USER_PASSWORD']).then((env) => {
    const password = env.TEST_USER_PASSWORD;
    if (typeof password !== 'string' || password.length === 0) {
      throw new Error(
        'Cypress login error: TEST_USER_PASSWORD is required for the seeded project member.'
      );
    }
    cy.login(SEEDED_PROJECT_MEMBER_EMAIL, password);
  });
}

function installReadOnlyMutationGuards(unexpectedMutations: string[]): void {
  MUTATION_METHODS.forEach((method) => {
    PERSISTENCE_ROUTES.forEach((url) => {
      cy.intercept(method, url, (request) => {
        const pathname = new URL(request.url).pathname;
        if (request.method === 'POST' && ESTIMATION_PATH.test(pathname)) {
          return;
        }

        unexpectedMutations.push(`${request.method} ${pathname}`);
        request.reply({
          statusCode: 409,
          body: {
            data: null,
            error: 'Unexpected persistence mutation blocked by Cypress',
          },
        });
      });
    });
  });
}

function aiEstimate(workItemId: string): SprintEstimationResult {
  return {
    workItemId,
    suggestedHours: 8.5,
    minimumHours: 6.5,
    maximumHours: 10.5,
    confidence: 'high',
    source: 'similar_history',
    evidenceCount: 5,
    roughEstimate: false,
    rationale: 'Comparable completed work supports this AI estimate.',
    estimationMethod: 'ai',
    fallbackReason: null,
  };
}

function fallbackEstimate(
  workItemId: string,
  fallbackReason: 'configuration' | 'provider_error' | 'timeout',
  rationale: string
): SprintEstimationResult {
  return {
    workItemId,
    suggestedHours: 4.5,
    minimumHours: 3.5,
    maximumHours: 6.5,
    confidence: 'low',
    source: 'rough_fallback',
    evidenceCount: 0,
    roughEstimate: true,
    rationale,
    estimationMethod: 'deterministic',
    fallbackReason,
  };
}

function partialFallbackResponse(
  sprintId: string,
  aiWorkItemId: string,
  fallbackWorkItemId: string
): SprintEstimationResponse {
  return {
    sprintId,
    aiStatus: 'partial_fallback',
    estimates: [
      aiEstimate(aiWorkItemId),
      fallbackEstimate(
        fallbackWorkItemId,
        'timeout',
        'Task-type fallback used because the AI request timed out.'
      ),
    ],
  };
}

function fullFallbackResponse(
  sprintId: string,
  firstWorkItemId: string,
  secondWorkItemId: string
): SprintEstimationResponse {
  return {
    sprintId,
    aiStatus: 'fallback',
    estimates: [
      fallbackEstimate(
        firstWorkItemId,
        'configuration',
        'Configuration fallback based on the work-item type.'
      ),
      fallbackEstimate(
        secondWorkItemId,
        'provider_error',
        'Provider fallback based on comparable project work.'
      ),
    ],
  };
}

function assertRenderedResponseOrder(expectedTitles: readonly string[]): void {
  cy.get('[data-testid="estimate-work-item-title"]').then(($titles) => {
    expect(
      [...$titles].map((title) => title.textContent?.trim())
    ).to.deep.equal(expectedTitles);
  });
}

describe('AI Sprint Estimation', () => {
  before(() => {
    cy.task('cleanTestSprints', { restoreOwner: false });
  });

  after(() => {
    cy.task('cleanTestSprints', { restoreOwner: true });
  });

  beforeEach(() => {
    cy.login();
    cy.intercept('POST', '**/api/sprints').as('createSprint');
    cy.intercept('POST', '**/api/work-items').as('createWorkItem');
    cy.visit('/backlog');
    cy.contains('[data-slot="breadcrumb-page"]', 'Backlog').should('exist');
  });

  it('preserves backend response order for partial-fallback estimates', () => {
    const suffix = Date.now();
    const sprintName = `Sprint E2E Estimation Partial ${suffix}`;
    const firstTitle = `Work Item E2E AI Estimate ${suffix}`;
    const secondTitle = `Work Item E2E Fallback Estimate ${suffix}`;
    let sprintId = '';
    let firstWorkItemId = '';
    let secondWorkItemId = '';
    const unexpectedMutations: string[] = [];

    createSprintFromBacklog(sprintName).then((id) => {
      sprintId = id;
    });
    createSprintWorkItem(sprintName, firstTitle).then((id) => {
      firstWorkItemId = id;
    });
    createSprintWorkItem(sprintName, secondTitle).then((id) => {
      secondWorkItemId = id;
    });

    installReadOnlyMutationGuards(unexpectedMutations);
    cy.intercept('POST', '**/api/v1/sprints/*/estimates', (request) => {
      expect(request.method).to.equal('POST');
      expect(new URL(request.url).pathname).to.equal(
        `/api/v1/sprints/${sprintId}/estimates`
      );
      expect(typeof request.body).to.equal('undefined');
      request.reply({
        statusCode: 200,
        body: {
          data: partialFallbackResponse(
            sprintId,
            secondWorkItemId,
            firstWorkItemId
          ),
          error: null,
        },
      });
    }).as('estimateSprint');

    openEstimationDialog(sprintName);
    cy.wait('@estimateSprint');

    cy.get('[role="dialog"]').within(() => {
      cy.contains('1 AI-generated and 1 deterministic estimate.').should(
        'be.visible'
      );
      assertRenderedResponseOrder([secondTitle, firstTitle]);
      cy.get('[data-testid="sprint-estimate-row"]')
        .eq(0)
        .should('contain.text', '8.5h')
        .and('contain.text', '6.5–10.5h range')
        .and('contain.text', 'AI-generated');
      cy.get('[data-testid="sprint-estimate-row"]')
        .eq(1)
        .should('contain.text', '4.5h')
        .and('contain.text', '3.5–6.5h range')
        .and('contain.text', 'Deterministic fallback')
        .and('contain.text', 'AI request timed out');
    });
    cy.then(() => expect(unexpectedMutations).to.deep.equal([]));
  });

  it('recovers from an error with read-only full fallback results', () => {
    const suffix = Date.now();
    const sprintName = `Sprint E2E Estimation Retry ${suffix}`;
    const firstTitle = `Work Item E2E Configuration Fallback ${suffix}`;
    const secondTitle = `Work Item E2E Provider Fallback ${suffix}`;
    let sprintId = '';
    let firstWorkItemId = '';
    let secondWorkItemId = '';
    let estimationCalls = 0;
    const unexpectedMutations: string[] = [];

    createSprintFromBacklog(sprintName).then((id) => {
      sprintId = id;
    });
    createSprintWorkItem(sprintName, firstTitle).then((id) => {
      firstWorkItemId = id;
    });
    createSprintWorkItem(sprintName, secondTitle).then((id) => {
      secondWorkItemId = id;
    });

    installReadOnlyMutationGuards(unexpectedMutations);
    cy.intercept('POST', '**/api/v1/sprints/*/estimates', (request) => {
      estimationCalls += 1;
      if (estimationCalls === 1) {
        request.reply({
          statusCode: 500,
          body: { data: null, error: 'Failed to estimate sprint' },
        });
        return;
      }
      request.reply({
        statusCode: 200,
        body: {
          data: fullFallbackResponse(
            sprintId,
            firstWorkItemId,
            secondWorkItemId
          ),
          error: null,
        },
      });
    }).as('retryEstimate');

    openEstimationDialog(sprintName);
    cy.wait('@retryEstimate');
    cy.get('[role="dialog"]')
      .find('[role="alert"]')
      .should('be.visible')
      .and(
        'contain.text',
        'Sprint estimates could not be generated. Please try again.'
      );
    cy.get('[role="dialog"]').contains('button', 'Try again').click();
    cy.wait('@retryEstimate');

    cy.get('[role="dialog"]').within(() => {
      cy.contains(
        'AI was unavailable. 2 deterministic estimates are shown.'
      ).should('be.visible');
      assertRenderedResponseOrder([firstTitle, secondTitle]);
      cy.contains('Configuration fallback based on the work-item type.')
        .scrollIntoView()
        .should('be.visible');
      cy.contains('Provider fallback based on comparable project work.')
        .scrollIntoView()
        .should('be.visible');
      cy.contains('AI is not configured').should('be.visible');
      cy.contains('AI provider error').should('be.visible');
      cy.contains('AI-generated').should('not.exist');
      cy.contains('button', /save|apply/i).should('not.exist');
      cy.contains('button', 'Close').should('be.visible');
    });
    cy.then(() => {
      expect(estimationCalls).to.equal(2);
      expect(unexpectedMutations).to.deep.equal([]);
    });
  });

  it('does not offer estimation actions to a project member', () => {
    const sprintName = `Sprint E2E Estimation Member ${Date.now()}`;
    let estimationCalls = 0;
    const unexpectedMutations: string[] = [];

    createSprintFromBacklog(sprintName);
    installReadOnlyMutationGuards(unexpectedMutations);
    cy.clearAllCookies();
    cy.clearAllLocalStorage();
    cy.clearAllSessionStorage();
    loginAsSeededProjectMember();
    cy.intercept('POST', '**/api/v1/sprints/*/estimates', (request) => {
      estimationCalls += 1;
      request.reply({ statusCode: 403, body: { error: 'Forbidden' } });
    });
    cy.visit('/backlog');

    getSprintCard(sprintName)
      .should('be.visible')
      .find('button[aria-label="Open Actions Menu"]')
      .should('not.exist');
    cy.get('[aria-label="Estimate with AI"]').should('not.exist');
    cy.then(() => {
      expect(estimationCalls).to.equal(0);
      expect(unexpectedMutations).to.deep.equal([]);
    });
  });
});
