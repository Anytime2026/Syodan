import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Link } from 'react-router-dom'
import './Button.css'

type ButtonVariant = 'filled' | 'tinted' | 'gray' | 'plain' | 'destructive'
type ButtonSize = 'default' | 'compact' | 'large'

type CommonProps = {
  variant?: ButtonVariant
  size?: ButtonSize
  icon?: string
  iconAlt?: string
  className?: string
  children: ReactNode
  autoWidth?: boolean
}

type ButtonAsButton = CommonProps &
  ButtonHTMLAttributes<HTMLButtonElement> & { to?: undefined }

type ButtonAsLink = CommonProps & {
  to: string
  onClick?: () => void
  disabled?: boolean
}

export type ButtonProps = ButtonAsButton | ButtonAsLink

function buildClassName(
  variant: ButtonVariant,
  size: ButtonSize,
  autoWidth: boolean,
  extra?: string,
): string {
  const legacy =
    variant === 'filled'
      ? 'primary'
      : variant === 'tinted'
        ? 'secondary'
        : ''
  return [
    'btn',
    `btn--${variant}`,
    legacy,
    size !== 'default' ? `btn--${size}` : '',
    autoWidth ? 'btn--auto' : '',
    extra ?? '',
  ]
    .filter(Boolean)
    .join(' ')
}

function ButtonContent({
  icon,
  iconAlt = '',
  children,
}: Pick<CommonProps, 'icon' | 'iconAlt' | 'children'>) {
  return (
    <>
      {icon && (
        <img className="btn__icon" src={icon} alt={iconAlt} draggable={false} />
      )}
      <span>{children}</span>
    </>
  )
}

export function Button(props: ButtonProps) {
  const {
    variant = 'filled',
    size = 'default',
    icon,
    iconAlt,
    className,
    children,
    autoWidth = false,
    ...rest
  } = props

  const cls = buildClassName(variant, size, autoWidth, className)

  if ('to' in props && props.to) {
    const { to, onClick, disabled } = props
    if (disabled) {
      return (
        <span className={`${cls} btn--disabled`} aria-disabled="true">
          <ButtonContent icon={icon} iconAlt={iconAlt}>
            {children}
          </ButtonContent>
        </span>
      )
    }
    return (
      <Link to={to} className={cls} onClick={onClick}>
        <ButtonContent icon={icon} iconAlt={iconAlt}>
          {children}
        </ButtonContent>
      </Link>
    )
  }

  const buttonProps = rest as ButtonHTMLAttributes<HTMLButtonElement>
  const { type = 'button', ...restButtonProps } = buttonProps
  return (
    <button type={type} className={cls} {...restButtonProps}>
      <ButtonContent icon={icon} iconAlt={iconAlt}>
        {children}
      </ButtonContent>
    </button>
  )
}
