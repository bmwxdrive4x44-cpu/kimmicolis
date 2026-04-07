# Security Audit - Quick Reference & Checklist

## Files Created ✅

```
✅ src/lib/validators.ts                        - 200+ lines of reusable validators
✅ src/hooks/use-form-validation.ts             - Hook for form state management  
✅ SECURITY_IMPLEMENTATION_GUIDE.md             - Complete 300+ line guide
✅ SECURITY_IMPLEMENTATION_EXAMPLE.tsx          - Detailed example (LitigesTab pattern)
✅ SECURITY_AUDIT_CHECKLIST.md                  - This file
```

---

## 30-Second Implementation Pattern

```typescript
import { useFormValidation } from '@/hooks/use-form-validation';
import { validateEmail, validatePhone } from '@/lib/validators';

function MyForm() {
  const [formData, setFormData] = useState({ email: '', phone: '' });
  const { fieldErrors, submitError, setFormField, validateForm } = useFormValidation({
    email: (v) => !validateEmail(v) ? 'Invalid email' : undefined,
    phone: (v) => !validatePhone(v) ? 'Invalid phone' : undefined,
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validateForm(formData)) return;  // Shows errors if invalid
    // API call here...
  };

  return (
    <form onSubmit={handleSubmit}>
      {submitError && <FormGlobalError message={submitError} />}
      <Input 
        value={formData.email}
        onChange={(e) => setFormField('email', e.target.value, (d) => setFormData(p => ({...p, ...d})))}
        className={fieldErrors.email ? 'border-red-400' : ''}
      />
      <FormFieldError message={fieldErrors.email} />
      <Button type="submit">Submit</Button>
    </form>
  );
}
```

---

## Forms to Secure (Priority Order)

### 🔴 RED - Critical (User Data, PII)
- [ ] `CreateParcelForm` (sender/recipient names + phones) - 45 min
- [ ] `LitigesTab` (description validation) - 20 min
- [ ] `BulkProCreateForm` (multiple parcels) - 1 hour

### 🟠 ORANGE - High (Partner Data)
- [ ] `ProfilRelaisTab` (RC number + commerce name) - 30 min
- [ ] `SettingsTab` (Relais phone/email) - 20 min

### 🟡 YELLOW - Medium (Admin Only)
- [ ] `LinesTab` (price validation) - 30 min
- [ ] `RelaysTab` (edit form) - 30 min

---

## Validation Rules Cheat Sheet

| Field | Rule | Import |
|-------|------|--------|
| Email | `!validateEmail(v)` | `validateEmail` |
| Phone | `!validatePhone(v)` | `validatePhone` |
| Name | `!validateName(v)` | `validateName` |
| Password | `!validatePassword(v)` | `validatePassword` |
| Address | `!validateAddress(v)` | `validateAddress` |
| Description | `!validateDescription(v)` | `validateDescription` |
| Weight | `!validateWeight(v)` | `validateWeight` |
| Number | `!validateInteger(v, min, max)` | `validateInteger` |
| RC Number | `!isAlgerianCommerceRegisterNumber(v)` | `isAlgerianCommerceRegisterNumber` |
| Future Date | `!validateFutureDate(v)` | `validateFutureDate` |

---

## Common Error Messages

```typescript
// Use clear, actionable messages in French

email: (v) => !validateEmail(v) ? 'Email invalide (ex: nom@exemple.com)' : undefined,
phone: (v) => !validatePhone(v) ? 'Téléphone invalide (8-15 chiffres)' : undefined,
firstName: (v) => !validateName(v) ? 'Prénom invalide (2-50 caractères, lettres)' : undefined,
password: (v) => !validatePassword(v) ? 'Mot de passe faible (6+ chars, nombre + spécial)' : undefined,
address: (v) => !validateAddress(v) ? 'Adresse invalide (5-200 caractères)' : undefined,
weight: (v) => !validateWeight(v) ? 'Poids invalide (0.1-30 kg)' : undefined,
capacity: (v) => !validateCapacity(v, 1, 200) ? 'Capacité invalide (1-200)' : undefined,
description: (v) => !validateDescription(v) ? 'Description trop longue (max 1000 chars)' : undefined,
```

---

## Implementation Checklist Template

For each form being secured:

```markdown
### Form Name: ________________

#### Basic Setup
- [ ] Import useFormValidation hook
- [ ] Import validators from lib/validators
- [ ] Initialize useState for formData
- [ ] Create validation config object
- [ ] Initialize validation hook

#### UI Changes
- [ ] Wrap each Input/Textarea with validation config
- [ ] Add className conditionals for border-red-400
- [ ] Add FormFieldError below each field
- [ ] Add FormGlobalError at form top
- [ ] Add onChange handlers with setFormField()

#### Submit Handler
- [ ] Call validateForm() before API call
- [ ] Return early if validation fails
- [ ] Sanitize data before sending (trim(), etc)
- [ ] Handle API error responses
- [ ] Map field errors from backend

#### Testing
- [ ] Test with valid data → submits
- [ ] Test with invalid data → shows errors
- [ ] Test empty fields → shows required errors
- [ ] Test special characters → sanitized or rejected
- [ ] Test API errors → map to form correctly
- [ ] Test XSS payload → escaped/removed
```

---

## API Response Format

All endpoints should return this structure:

```json
// Success
{
  "success": true,
  "data": { ... }
}

// Validation error (single field)
{
  "error": "Email already exists",
  "code": "EMAIL_ALREADY_EXISTS",
  "field": "email"
}

// Validation error (multiple fields)
{
  "error": "Missing required fields",
  "code": "MISSING_REQUIRED_FIELDS", 
  "fields": ["email", "phone", "name"]
}

// General error
{
  "error": "Internal server error",
  "code": "SERVER_ERROR"
}
```

---

## Backend Validation Endpoints to Review

```bash
# Check these files for input validation:
src/app/api/parcels/route.ts
src/app/api/relais/[id]/route.ts  
src/app/api/litiges/route.ts
src/app/api/lignes/route.ts

# Each should:
✓ Validate all input fields
✓ Return structured errors {error, code, field?}
✓ Sanitize strings before DB save
✓ Check authorization
✓ Use TypeScript types
```

---

## XSS Prevention (Critical!)

```typescript
// ❌ WRONG - XSS vulnerability
const html = `<p>Name: ${userData.name}</p>`;

// ✅ RIGHT - XSS protected
import { escapeHtml } from '@/lib/validators';
const html = `<p>Name: ${escapeHtml(userData.name)}</p>`;

// ✅ RIGHT - Use React (automatically escapes)
return <p>Name: {userData.name}</p>;
```

**Unsafe locations:**
- Template literals in HTML generation (like label printing)
- innerHTML assignments
- Script injection in email templates

**Safe locations:**
- React JSX (auto-escaped)
- textContent assignments
- Data attributes

---

## Testing Security

### SQL Injection Test
```
Email: ' OR '1'='1
Result: Should be rejected or escaped
```

### XSS Test
```
Name: <script>alert('XSS')</script>
Result: Should be HTML-escaped or removed
```

### Buffer Overflow Test
```
Name: aaaa...aaaa (5000+ characters)
Result: Should be truncated to max length
```

### Invalid Format Tests
```
Phone: abc123 (not numeric) → Rejected
Email: notanemail (no @) → Rejected
Date: 2020-01-01 (in past) → Rejected
```

---

## Resources

- Validators library: `src/lib/validators.ts` (copy-past validators into your form)
- Form hook: `src/hooks/use-form-validation.ts` (import and use)
- Example: `SECURITY_IMPLEMENTATION_EXAMPLE.tsx` (follow this pattern)
- Full guide: `SECURITY_IMPLEMENTATION_GUIDE.md` (detailed instructions)

---

## Quick Stats

- **Total Validators:** 15+
- **Lines of Validation Code:** 200+
- **Reusable Components:** 3 (validators, hook, components)
- **Forms to Secure:** 12
- **Estimated Total Time:** 8-10 hours
- **Risk Level (Current):** HIGH (no frontend validation, PII exposed)
- **Risk Level (After):** LOW (comprehensive validation + error handling)

---

## Done Checklist

```
✅ Analyzed entire site
✅ Identified all 12 forms  
✅ Created validators library (15+ functions)
✅ Created useFormValidation hook
✅ Created example implementation
✅ Documented complete guide (300+ lines)
✅ TypeScript compilation verified (no errors)
✅ Created this quick reference

⏳ TODO: Apply to each form (1-2 hours per form)
⏳ TODO: Verify all APIs validate input
⏳ TODO: Test security scenarios
⏳ TODO: Final compilation check
```

---

## Next Actions

1. **Right Now:** Pick one small form (like LitigesTab)
2. **15 Minutes:** Copy useFormValidation pattern from example
3. **30 Minutes:** Add validation rules to form
4. **15 Minutes:** Update UI with error display
5. **Test:** Submit form with invalid data, see errors appear
6. **Repeat:** Do next form (takes faster each time)

---

**Time to Full Security:** 8-10 hours  
**Current Status:** Foundation complete, ready for implementation  
**Started:** 2026-04-03  
**Target Completion:** 2026-04-10
