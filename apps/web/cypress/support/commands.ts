/* eslint-disable no-unused-vars */
/* eslint-disable @typescript-eslint/no-namespace */

// ***********************************************
// This example commands.ts shows you how to
// create various custom commands and overwrite
// existing commands.
//
// For more comprehensive examples of custom
// commands please read more here:
// https://on.cypress.io/custom-commands
// ***********************************************

declare global {
  namespace Cypress {
    interface Chainable {
      login(email?: string, password?: string): Chainable<void>;
    }
  }
}

Cypress.Commands.add('login', (email, password) => {
  cy.env(['TEST_USER_EMAIL', 'TEST_USER_PASSWORD']).then((env) => {
    const finalEmail = email || env.TEST_USER_EMAIL;
    const finalPassword = password || env.TEST_USER_PASSWORD;
    if (!finalEmail || !finalPassword) {
      throw new Error(
        'Cypress login error: TEST_USER_EMAIL or TEST_USER_PASSWORD environment variable is missing.'
      );
    }
    cy.visit('/login');
    cy.get('#email').type(finalEmail);
    cy.get('#password').type(finalPassword);
    cy.get('button[type="submit"]').click();
    cy.url().should('include', '/dashboard');
  });
});
