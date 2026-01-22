# PR Checklists - Gonthia CRM

## Overview

These checklists ensure consistent quality across all pull requests. Use the appropriate checklist based on the type of change.

---

## General PR Checklist

All PRs must complete this checklist:

### Code Quality
- [ ] Code follows project style guide
- [ ] No TypeScript errors (`npm run typecheck`)
- [ ] No ESLint errors (`npm run lint`)
- [ ] No unnecessary comments or console.logs
- [ ] Complex logic is documented
- [ ] No hardcoded secrets or credentials

### Testing
- [ ] Unit tests added for new functionality
- [ ] Existing tests pass (`npm run test`)
- [ ] Manual testing completed
- [ ] Edge cases considered

### Documentation
- [ ] README updated if needed
- [ ] API documentation updated if endpoints changed
- [ ] Inline comments for complex logic

### Review
- [ ] PR description explains the change
- [ ] Related issues linked
- [ ] Screenshots included for UI changes
- [ ] Self-review completed

---

## Security PR Checklist

For changes touching authentication, authorization, or sensitive data:

### Authentication
- [ ] Session handling reviewed
- [ ] Password handling follows best practices
- [ ] No sensitive data in logs
- [ ] No sensitive data in error messages

### Authorization
- [ ] Permission checks present
- [ ] Tenant isolation verified
- [ ] Role-based access enforced
- [ ] Object-level access checked (if applicable)

### Input Validation
- [ ] All inputs validated with Zod
- [ ] SQL injection impossible (parameterized queries)
- [ ] XSS prevention verified
- [ ] File upload restrictions (if applicable)

### Security Review
- [ ] No hardcoded credentials
- [ ] Environment variables used for secrets
- [ ] Security headers maintained
- [ ] CSRF protection in place

### Testing
- [ ] Security-specific tests added
- [ ] Negative test cases (invalid input, unauthorized access)
- [ ] Rate limiting tested (if applicable)

---

## API Route PR Checklist

For changes to API endpoints:

### Endpoint Design
- [ ] RESTful conventions followed
- [ ] HTTP methods appropriate
- [ ] Status codes correct
- [ ] Response format consistent

### Authentication/Authorization
- [ ] `requireAuth()` called for protected routes
- [ ] Role checks implemented
- [ ] Tenant filtering applied
- [ ] Object-level authorization (if needed)

### Validation
- [ ] Request body validated with Zod schema
- [ ] Query parameters validated
- [ ] URL parameters validated
- [ ] Error messages helpful

### Error Handling
- [ ] Errors caught and handled
- [ ] Appropriate status codes returned
- [ ] Error details logged (not exposed)
- [ ] Consistent error response format

### Performance
- [ ] Database queries optimized
- [ ] Pagination implemented for lists
- [ ] No N+1 queries
- [ ] Response size reasonable

### Audit
- [ ] Audit logging added for data changes
- [ ] Audit context accurate

### Testing
- [ ] Integration tests added
- [ ] Success cases tested
- [ ] Error cases tested
- [ ] Authorization tests included

---

## Database/Schema PR Checklist

For changes to database schema or migrations:

### Schema Changes
- [ ] Migration file created
- [ ] Migration is reversible (or documented why not)
- [ ] Indexes added for query patterns
- [ ] Foreign keys appropriate
- [ ] Nullable/default values correct

### Data Safety
- [ ] No data loss in migration
- [ ] Backfill strategy for new required columns
- [ ] Large table changes reviewed for locking

### Compatibility
- [ ] Old code works during migration
- [ ] Rollback plan documented
- [ ] Zero-downtime deployment considered

### Testing
- [ ] Migration tested on copy of production data
- [ ] Schema changes tested
- [ ] ORM types updated

### Documentation
- [ ] Schema diagram updated
- [ ] Column documentation added

---

## Frontend PR Checklist

For UI and frontend changes:

### UI/UX
- [ ] Matches design specifications
- [ ] Responsive on mobile
- [ ] Accessible (ARIA labels, keyboard navigation)
- [ ] Loading states implemented
- [ ] Error states implemented
- [ ] Empty states implemented

### Code Quality
- [ ] Components properly typed
- [ ] Props documented
- [ ] Reusable components used
- [ ] No inline styles (use Tailwind)

### Performance
- [ ] No unnecessary re-renders
- [ ] Images optimized
- [ ] Lazy loading where appropriate
- [ ] Bundle size impact reviewed

### State Management
- [ ] State managed appropriately
- [ ] Form validation working
- [ ] API calls handled properly
- [ ] Error handling in place

### Testing
- [ ] Component tests added
- [ ] Interaction tests for complex components
- [ ] Manual cross-browser testing

---

## Bug Fix PR Checklist

For bug fixes:

### Root Cause
- [ ] Root cause identified and documented
- [ ] Fix addresses root cause (not just symptoms)
- [ ] Related issues checked for similar bugs

### Regression Prevention
- [ ] Test added that would catch this bug
- [ ] Test fails without the fix
- [ ] Test passes with the fix

### Impact Assessment
- [ ] Related functionality tested
- [ ] No new bugs introduced
- [ ] Performance impact assessed

### Documentation
- [ ] Bug description in PR
- [ ] Steps to reproduce documented
- [ ] Fix explanation provided

---

## Performance PR Checklist

For performance-related changes:

### Measurement
- [ ] Before/after metrics documented
- [ ] Benchmark methodology described
- [ ] Multiple test runs performed

### Analysis
- [ ] Bottleneck identified
- [ ] Solution appropriate for bottleneck
- [ ] No premature optimization

### Verification
- [ ] Performance improvement verified
- [ ] No functionality regression
- [ ] No memory leaks introduced

### Documentation
- [ ] Performance impact documented
- [ ] Monitoring added if applicable

---

## Dependency PR Checklist

For adding or updating dependencies:

### New Dependency
- [ ] Necessity justified
- [ ] Package is actively maintained
- [ ] License is compatible
- [ ] Security vulnerabilities checked
- [ ] Bundle size impact acceptable
- [ ] Alternative packages considered

### Dependency Update
- [ ] Changelog reviewed
- [ ] Breaking changes addressed
- [ ] Security patches included
- [ ] All tests pass
- [ ] Manual testing completed

### Documentation
- [ ] Usage documented if new
- [ ] Version pinning strategy followed

---

## Release PR Checklist

For release branches:

### Version
- [ ] Version number updated
- [ ] Changelog updated
- [ ] Migration notes written

### Testing
- [ ] Full test suite passes
- [ ] Manual smoke testing completed
- [ ] Performance testing completed
- [ ] Security review completed

### Deployment
- [ ] Environment variables documented
- [ ] Database migrations ready
- [ ] Rollback plan documented
- [ ] Monitoring alerts configured

### Documentation
- [ ] Release notes prepared
- [ ] User-facing changes documented
- [ ] API changes documented

---

## PR Template

```markdown
## Description
<!-- What does this PR do? -->

## Related Issues
<!-- Link to related issues: Fixes #123 -->

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Performance improvement
- [ ] Security fix
- [ ] Documentation
- [ ] Other: ___

## Checklist
- [ ] I have performed a self-review
- [ ] I have added tests
- [ ] I have updated documentation
- [ ] My changes generate no new warnings

## Testing
<!-- How was this tested? -->

## Screenshots
<!-- If applicable, add screenshots -->

## Additional Notes
<!-- Any additional context -->
```

---

## Review Guidelines

### For Reviewers

1. **Focus Areas by Priority:**
   - Security implications
   - Data integrity
   - Performance impact
   - Code correctness
   - Code quality

2. **Review Questions:**
   - Does this solve the stated problem?
   - Are there simpler solutions?
   - Are edge cases handled?
   - Is the code testable?
   - Will this be easy to maintain?

3. **Feedback Style:**
   - Be constructive and specific
   - Suggest alternatives, not just problems
   - Distinguish between required and optional changes
   - Acknowledge good work

### For Authors

1. **Before Requesting Review:**
   - Complete relevant checklist
   - Self-review your code
   - Ensure CI passes
   - Test manually

2. **During Review:**
   - Respond to all comments
   - Explain decisions when asked
   - Be open to feedback
   - Update PR as needed

3. **After Approval:**
   - Squash commits if needed
   - Update PR description
   - Merge promptly
