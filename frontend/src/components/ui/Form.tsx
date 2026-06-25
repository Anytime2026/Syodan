import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react'
import './Form.css'

type FormFieldProps = {
  label: string
  hint?: string
  error?: string
  children: ReactNode
  className?: string
}

export function FormField({ label, hint, error, children, className = '' }: FormFieldProps) {
  return (
    <div className={`form-field ${className}`.trim()}>
      <label className="form-field__label">{label}</label>
      {children}
      {hint && !error && <p className="form-field__hint">{hint}</p>}
      {error && <p className="form-field__error">{error}</p>}
    </div>
  )
}

export function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="info-row">
      <span className="info-row__label">{label}</span>
      <span className="info-row__value">{value}</span>
    </div>
  )
}

type SelectFieldProps = SelectHTMLAttributes<HTMLSelectElement> & {
  label: string
  hint?: string
}

export function SelectField({ label, hint, children, ...props }: SelectFieldProps) {
  return (
    <FormField label={label} hint={hint}>
      <select {...props}>{children}</select>
    </FormField>
  )
}

type TextAreaFieldProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label: string
  hint?: string
}

export function TextAreaField({ label, hint, ...props }: TextAreaFieldProps) {
  return (
    <FormField label={label} hint={hint}>
      <textarea {...props} />
    </FormField>
  )
}

type InputFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string
  hint?: string
}

export function InputField({ label, hint, ...props }: InputFieldProps) {
  return (
    <FormField label={label} hint={hint}>
      <input {...props} />
    </FormField>
  )
}
