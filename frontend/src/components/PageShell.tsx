import { Link } from 'react-router-dom'
import type { ReactNode } from 'react'
import './PageShell.css'

type PageShellProps = {
  children?: ReactNode
  title?: string
  subtitle?: string
  width?: 'narrow' | 'wide'
  showBrand?: boolean
  brandLink?: boolean
  illustration?: string
  illustrationAlt?: string
}

export function PageShell({
  children,
  title,
  subtitle,
  width = 'wide',
  showBrand = true,
  brandLink = true,
  illustration,
  illustrationAlt = '',
}: PageShellProps) {
  const logo = (
    <img
      className="page-shell__brand"
      src="/images/ServiceName.svg"
      alt="SalesGym"
      width={220}
      height={46}
      draggable={false}
    />
  )

  return (
    <div className={`page-shell page-shell--${width}`}>
      {showBrand && (
        <header className="page-shell__header">
          {brandLink ? (
            <Link to="/" className="page-shell__brand-link" aria-label="ホーム">
              {logo}
            </Link>
          ) : (
            logo
          )}
        </header>
      )}

      {(title || subtitle || illustration) && (
        <div className="page-shell__intro">
          {illustration && (
            <img
              className="page-shell__illustration"
              src={illustration}
              alt={illustrationAlt}
              draggable={false}
            />
          )}
          <div className="page-shell__intro-text">
            {title && <h1 className="page-shell__title">{title}</h1>}
            {subtitle && <p className="page-shell__subtitle">{subtitle}</p>}
          </div>
        </div>
      )}

      <div className="page-shell__body">{children}</div>
    </div>
  )
}

type PageSectionProps = {
  children: ReactNode
  variant?: 'oat' | 'blue' | 'paper'
  className?: string
}

export function PageSection({
  children,
  variant = 'oat',
  className = '',
}: PageSectionProps) {
  return (
    <section className={`page-section page-section--${variant} ${className}`.trim()}>
      {children}
    </section>
  )
}

type PageEmptyProps = {
  image: string
  title: string
  description?: string
}

export function PageEmpty({ image, title, description }: PageEmptyProps) {
  return (
    <div className="page-empty">
      <img className="page-empty__image" src={image} alt="" draggable={false} />
      <p className="page-empty__title">{title}</p>
      {description && <p className="page-empty__description">{description}</p>}
    </div>
  )
}

type PageActionsProps = {
  children: ReactNode
}

export function PageActions({ children }: PageActionsProps) {
  return <div className="page-actions">{children}</div>
}
