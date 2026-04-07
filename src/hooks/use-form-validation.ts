'use client';

import { useState, useCallback } from 'react';

export type ValidationRule<TValue> = (value: TValue) => string | undefined;

export type FormValidationConfig<T> = Partial<{
  [fieldKey in keyof T]: ValidationRule<T[fieldKey]>;
}>;

/**
 * useFormValidation - Reusable hook for form field validation
 * 
 * Manages:
 * - fieldErrors state (per-field error messages)
 * - submitError state (global form error)
 * - setFormField() helper (clears error + updates form)
 * - validateForm() runner (validates per config)
 * 
 * Usage:
 * ```tsx
 * const { fieldErrors, submitError, setFormField, validateForm } = useFormValidation<FormData>(
 *   {
 *     email: (val) => !validateEmail(val) ? 'Invalid email' : undefined,
 *     phone: (val) => !validatePhone(val) ? 'Invalid phone' : undefined,
 *   }
 * );
 * 
 * // In form change handlers:
 * setFormField('email', e.target.value);
 * 
 * // In form submit:
 * if (!validateForm(formData)) return;
 * ```
 */
export function useFormValidation<T extends Record<string, any>>(
  validationConfig: FormValidationConfig<T>
) {
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof T, string>>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);

  /**
   * Clear an individual field error and update the form field value
   */
  const setFormField = useCallback(
    (key: keyof T, value: any, onFormChange: (data: any) => void) => {
      // Clear error
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
      // Clear submit error
      setSubmitError(null);
      // Update form data
      onFormChange({ [key]: value });
    },
    []
  );

  /**
   * Validate form based on config
   * Returns true if valid, false if errors
   */
  const validateForm = useCallback((formData: T): boolean => {
    const errors: Partial<Record<keyof T, string>> = {};

    // Run all validation rules
    Object.keys(validationConfig).forEach((fieldKey) => {
      const key = fieldKey as keyof T;
      const rule = validationConfig[key];
      if (rule) {
        const error = rule(formData[key]);
        if (error) {
          errors[key] = error;
        }
      }
    });

    setFieldErrors(errors);

    // Set global error message if any field has error
    if (Object.keys(errors).length > 0) {
      setSubmitError('Veuillez corriger les champs en rouge.');
      return false;
    }

    setSubmitError(null);
    return true;
  }, [validationConfig]);

  /**
   * Manually clear all errors
   */
  const clearErrors = useCallback(() => {
    setFieldErrors({});
    setSubmitError(null);
  }, []);

  /**
   * Manually set a field error
   */
  const setFieldError = useCallback((key: keyof T, message: string | undefined) => {
    setFieldErrors((prev) => {
      if (message === undefined) {
        const next = { ...prev };
        delete next[key];
        return next;
      }
      return { ...prev, [key]: message };
    });
  }, []);

  return {
    fieldErrors,
    submitError,
    setSubmitError,
    setFormField,
    validateForm,
    clearErrors,
    setFieldError,
  };
}
