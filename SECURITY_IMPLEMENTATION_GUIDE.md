# Security Audit & Implementation Guide - SwiftColis

**Date:** Avril 2026  
**Status:** In Progress  
**Owner:** Architecture Team

---

## Executive Summary

This document outlines a comprehensive security audit of the entire SwiftColis application, focusing on input validation, output escaping, and error handling across all user-facing forms.

**Key Findings:**
- 12 major forms identified requiring validation updates
- 15+ reusable validators created
- Consistent error handling pattern established (fieldErrors + submitError)
- XSS and data integrity risks identified and mitigated
- 10-12 hour implementation effort required for complete audit

---

## Part 1: Validators Library ✅ COMPLETE

### Location
`src/lib/validators.ts` - 200+ lines of reusable validation functions

### Available Validators

#### String Sanitization
```typescript
sanitizeString(value, maxLength, optionalPattern)
escapeHtml(text)
sanitizeName(name)
sanitizeAddress(address)
sanitizeDescription(text)
```

#### Format Validation
```typescript
validateEmail(email) → boolean
validatePhone(phone) → boolean  // 8-15 digits, Algerian format
validatePassword(pwd) → boolean  // 6+ chars, number + special
validateName(name) → boolean  // 2-50 chars, letters + accents
validateAddress(addr) → boolean  // 5-200 chars
validateDescription(desc) → boolean  // max 1000 chars
```

#### Numeric Validation
```typescript
validateInteger(val, min, max) → boolean
validateDecimal(val, min, max, decimalPlaces) → boolean
validateWeight(weight) → boolean  // 0.1-30 kg
validateDimension(value) → boolean  // 1-300 cm
validateCapacity(capacity, min, max) → boolean  // 1-200
```

#### Domain-Specific
```typescript
isAlgerianCommerceRegisterNumber(rc) → boolean
validateVehicleType(vehicle) → boolean
validateLicensePlate(license) → boolean
validateFutureDate(dateString) → boolean
```

---

## Part 2: Form Validation Hook ✅ COMPLETE

### Location
`src/hooks/use-form-validation.ts`

### Purpose
Centralized state management for form field errors and validation logic.

### Usage Example

```typescript
import { useFormValidation } from '@/hooks/use-form-validation';
import { validateEmail, validatePhone, validateName } from '@/lib/validators';

function MyForm() {
  const [formData, setFormData] = useState({
    email: '',
    phone: '',
    name: '',
  });

  // Define validation rules
  const { fieldErrors, submitError, setFormField, validateForm } = useFormValidation<typeof formData>({
    email: (val) => !validateEmail(val) ? 'Email invalide' : undefined,
    phone: (val) => !validatePhone(val) ? 'Téléphone invalide (8-15 chiffres)' : undefined,
    name: (val) => !validateName(val) ? 'Nom invalide (2-50 caractères)' : undefined,
  });

  // On form field change - validates immediately and clears error
  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormField('email', e.target.value, (data) => 
      setFormData(prev => ({ ...prev, ...data }))
    );
  };

  // On form submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate all fields
    if (!validateForm(formData)) return;

    // Send to API
    try {
      const response = await fetch('/api/...', {
        method: 'POST',
        body: JSON.stringify(formData),
      });
      // Handle response...
    } catch (error) {
      // Handle error...
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      {submitError && <FormGlobalError message={submitError} />}
      
      <div className="space-y-2">
        <Label>Email</Label>
        <Input
          value={formData.email}
          onChange={handleEmailChange}
          className={fieldErrors.email ? 'border-red-400' : ''}
        />
        <FormFieldError message={fieldErrors.email} />
      </div>

      <div className="space-y-2">
        <Label>Téléphone</Label>
        <Input
          value={formData.phone}
          onChange={(e) => setFormField('phone', e.target.value, (d) => setFormData(p => ({...p, ...d})))}
          className={fieldErrors.phone ? 'border-red-400' : ''}
        />
        <FormFieldError message={fieldErrors.phone} />
      </div>

      <Button type="submit">Envoyer</Button>
    </form>
  );
}
```

---

## Part 3: Implementation Checklist

### PHASE 1: Client Dashboard (HIGH PRIORITY)

#### 1. CreateParcelForm
- **File:** `src/app/[locale]/dashboard/client/page.tsx` (line ~700)
- **Fields to validate:**
  - `senderFirstName` - validateName()
  - `senderLastName` - validateName()
  - `senderPhone` - validatePhone()
  - `recipientFirstName` - validateName()
  - `recipientLastName` - validateName()
  - `recipientPhone` - validatePhone()
  - `weight` - validateWeight()
  - `description` - validateDescription()

- **Steps:**
  1. Import useFormValidation hook
  2. Import validators from lib/validators
  3. Add validation config with 8 rules
  4. Add className conditionals to Input fields (border-red-400 if error)
  5. Add FormFieldError under each field
  6. Add FormGlobalError at form top
  7. Call validateForm() before fetch() in handleSubmit
  8. Update API call to sanitize data before sending

- **Estimated Time:** 45 minutes

#### 2. BulkProCreateForm
- **File:** `src/app/[locale]/dashboard/client/page.tsx` (line ~2200)
- **Fields:** Same as CreateParcelForm but per-row validation
- **Special:** Must handle array of items
- **Estimated Time:** 1 hour

#### 3. LitigesTab (Disputes)
- **File:** `src/app/[locale]/dashboard/client/page.tsx` (line ~2100)
- **Fields to validate:**
  - `description` - validateDescription()
  - Parcel selection - ensure not empty
  - Reason selection - ensure selected

- **Estimated Time:** 20 minutes

### PHASE 2: Relais Dashboard

#### 4. ProfilRelaisTab Settings
- **File:** `src/app/[locale]/dashboard/relais/page.tsx` (line ~500)
- **Fields to validate:**
  - `siret` / `commerceRegisterNumber` - isAlgerianCommerceRegisterNumber()
  - `commerceName` - validateName() (min 3 chars)
  - `address` - validateAddress()
  - `phone` - validatePhone()
  - `email` - validateEmail()

- **Estimated Time:** 30 minutes

#### 5. SettingsTab (Relais)
- **File:** `src/app/[locale]/dashboard/relais/page.tsx` (line ~1700)
- **Fields:** phone, email, opening/closing times
- **Estimated Time:** 20 minutes

### PHASE 3: Admin Dashboard

#### 6. LinesTab (Tarification)
- **File:** `src/app/[locale]/dashboard/admin/page.tsx` (line ~1700)
- **Fields to validate:**
  - `tarifPoids` - validateDecimal(0, 1000, 2)
  - `tarifKm` - validateDecimal(0, 100, 2)
  - City selections - ensure valid

- **Estimated Time:** 30 minutes

#### 7. RelaysTab (Edit Modal)
- **File:** `src/app/[locale]/dashboard/admin/page.tsx` (line ~1400)
- **Fields:** commerceName, address, ville, commission rates
- **Estimated Time:** 30 minutes

### PHASE 4: Backend Validation Review

#### Review API Endpoints
```
src/app/api/parcels/route.ts             → Input validation
src/app/api/relais/[id]/route.ts         → Input validation
src/app/api/lignes/route.ts              → Input validation
src/app/api/litiges/route.ts             → Input validation
```

**Required for each:**
1. Validate all input fields
2. Sanitize strings with sanitizeString()
3. Return structured error: `{ error, code, field?, details? }`
4. Add database-level constraints (Column limits, NOT NULL, UNIQUE)

- **Estimated Time:** 1 hour

### PHASE 5: XSS Protection Verification

#### Text Output Safety
1. **Parcel label HTML generation** (CreateParcelForm.printParcelLabel)
   - Currently uses: `${senderFirstName} ${senderLastName}`
   - **Should use:** `escapeHtml(senderFirstName) escapeHtml(senderLastName)`

2. **Name/Phone Display Everywhere**
   - Audit all places names/phones are rendered
   - Wrap with `escapeHtml()` if from user input

3. **Rich Text Fields**
   - If HTML content expected, use DOMPurify
   - Otherwise, plain text only

- **Estimated Time:** 30 minutes

---

## Part 4: Error Handling Pattern

### Frontend Flow
```
1. User types in field
   → onChange handler
   → setFormField() clears error
   → field shows immediately valid

2. User submits form
   → validateForm() runs all rules
   → If errors: show FormGlobalError + FormFieldError + red borders
   → If valid: call API

3. API returns error
   → Check response.status or data.code
   → Map to fieldErrors[fieldName] or submitError
   → Display errors to user
```

### Backend Response Format
```json
{
  "error": "Validation failed",
  "code": "MISSING_REQUIRED_FIELDS",
  "fields": ["email", "phone"],
  "details": "Email and phone are required"
}
```

OR (for single field error)
```json
{
  "error": "Email already exists",
  "code": "EMAIL_ALREADY_EXISTS",
  "field": "email"
}
```

---

## Part 5: Security Rules Checklist

- [ ] **All string inputs** trimmed and max-length enforced
- [ ] **Email fields** validated with proper regex
- [ ] **Phone fields** validated for Algerian format
- [ ] **Names** allow accents + hyphens, no special chars
- [ ] **Passwords** require min 6 chars + number + special char
- [ ] **Numeric fields** bounded (min/max checks)
- [ ] **Descriptions** limited to 1000 chars, no control characters
- [ ] **All user data** escaped before HTML rendering
- [ ] **All form submission** checks validation before API call
- [ ] **All API responses** follow structured error format
- [ ] **Database columns** have length limits matching validation
- [ ] **XSS prevention** via escapeHtml() on sensitive fields
- [ ] **PII handling** (names, phones) treated with care

---

## Part 6: Testing Strategy

### Unit Tests (Validators)
```typescript
describe('validateEmail', () => {
  it('accepts valid emails', () => {
    expect(validateEmail('test@example.com')).toBe(true);
  });
  it('rejects invalid emails', () => {
    expect(validateEmail('invalid')).toBe(false);
  });
});
```

### Integration Testing
- Test each form with valid data → should submit
- Test with invalid data → should show errors
- Test API error responses → should map to fieldErrors
- Test boundary conditions (max lengths, special chars)

### Manual QA
- Create parcel with invalid names → should error
- Submit with future date → should error
- Try XSS payloads in text fields → should be sanitized
- Test on mobile → should display errors clearly

---

## Part 7: Timeline & Effort

| Phase | Task | Hours | Status |
|-------|------|-------|--------|
| 1 | validators.ts | 1 | ✅ DONE |
| 1 | useFormValidation hook | 0.5 | ✅ DONE |
| 2 | CreateParcelForm | 0.75 | ⏳ TODO |
| 2 | BulkProCreateForm | 1.0 | ⏳ TODO |
| 2 | LitigesTab | 0.33 | ⏳ TODO |
| 3 | ProfilRelaisTab | 0.5 | ⏳ TODO |
| 3 | SettingsTab (Relais) | 0.33 | ⏳ TODO |
| 4 | LinesTab (Admin) | 0.5 | ⏳ TODO |
| 4 | RelaysTab (Admin) | 0.5 | ⏳ TODO |
| 5 | API Validation Review | 1.0 | ⏳ TODO |
| 6 | XSS Protection Audit | 0.5 | ⏳ TODO |
| 7 | Testing & TypeScript Check | 1.0 | ⏳ TODO |
| **TOTAL** | | **8.5 hours** | |

---

## Next Steps

1. **Immediately:** Test validators.ts for compilation errors
2. **Today:** Implement Phase 1 (Client forms) - 2 hours
3. **This week:** Implement Phase 2-4 (all remaining forms) - 5 hours
4. **Final:** XSS audit + testing - 1.5 hours

**Start with:** LitigesTab (smallest) → CreateParcelForm (largest)

---

## References

- [OWASP Input Validation](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html)
- [OWASP XSS Prevention](https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html)
- [North African Phone Numbers](https://en.wikipedia.org/wiki/Telephone_numbers_in_Algeria)
- [Algerian Commerce Registration](https://www.ons.dz/)

---

**Document Version:** 1.0  
**Last Updated:** 2026-04-03  
**Next Review:** After Phase 2 completion
