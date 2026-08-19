describe('Homepage', () => {
  it('should load successfully and display the main title', () => {
    cy.visit('/');
    cy.get('h1').should('contain', 'Alice');
    cy.get('h2').should('contain', 'Plan, track, and deliver work together');
  });
});
