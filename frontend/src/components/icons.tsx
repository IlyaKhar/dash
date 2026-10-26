import type { SVGProps } from 'react'

type Props = SVGProps<SVGSVGElement>

function Icon({ children, ...rest }: Props) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {children}
    </svg>
  )
}

export const FolderIcon = (p: Props) => (
  <Icon {...p}>
    <path d="M3 7.5A2.5 2.5 0 0 1 5.5 5h3.1c.6 0 1.2.24 1.63.68l1.02 1.03c.2.2.47.31.75.31h6.5A2.5 2.5 0 0 1 21 9.5v7A2.5 2.5 0 0 1 18.5 19h-13A2.5 2.5 0 0 1 3 16.5z" />
  </Icon>
)

export const FolderPlusIcon = (p: Props) => (
  <Icon {...p}>
    <path d="M3 7.5A2.5 2.5 0 0 1 5.5 5h3.1c.6 0 1.2.24 1.63.68l1.02 1.03c.2.2.47.31.75.31h6.5A2.5 2.5 0 0 1 21 9.5v7A2.5 2.5 0 0 1 18.5 19h-13A2.5 2.5 0 0 1 3 16.5z" />
    <path d="M12 10.5v5M9.5 13h5" />
  </Icon>
)

export const SearchIcon = (p: Props) => (
  <Icon {...p}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="m16 16 4.5 4.5" />
  </Icon>
)

export const ComposeIcon = (p: Props) => (
  <Icon {...p}>
    <path d="M4 20h4.5L20 8.5a2.12 2.12 0 0 0-3-3L5.5 17z" />
    <path d="M14.5 5.5 18.5 9.5" />
  </Icon>
)

export const TrashIcon = (p: Props) => (
  <Icon {...p}>
    <path d="M4 7h16M9.5 7V5.5A1.5 1.5 0 0 1 11 4h2a1.5 1.5 0 0 1 1.5 1.5V7" />
    <path d="M6.5 7 7.5 19a1.6 1.6 0 0 0 1.6 1.5h5.8A1.6 1.6 0 0 0 16.5 19L17.5 7" />
    <path d="M10.5 11v6M13.5 11v6" />
  </Icon>
)

export const PinIcon = (p: Props) => (
  <Icon {...p}>
    <path d="M9 4h6l-.7 5.2 3 3.3H15v3.1l-3 3.4-3-3.4v-3.1H6.7l3-3.3z" />
  </Icon>
)

export const CircleIcon = (p: Props) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="8.5" />
  </Icon>
)

export const CheckCircleIcon = (p: Props) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="8.5" fill="currentColor" stroke="none" />
    <path d="m8.2 12.2 2.6 2.6 5-5.4" stroke="var(--check-mark)" strokeWidth="2" />
  </Icon>
)

export const CheckIcon = (p: Props) => (
  <Icon {...p}>
    <path d="m5 12.5 4.5 4.5L19 7" strokeWidth="2" />
  </Icon>
)

export const CalendarIcon = (p: Props) => (
  <Icon {...p}>
    <rect x="3.5" y="5" width="17" height="15" rx="3" />
    <path d="M3.5 9.5h17M8.5 3.5v3M15.5 3.5v3" />
  </Icon>
)

export const ClockIcon = (p: Props) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.5V12l3 2" />
  </Icon>
)

export const ListIcon = (p: Props) => (
  <Icon {...p}>
    <path d="M4 6.5h16M4 12h16M4 17.5h11" />
  </Icon>
)

export const SidebarIcon = (p: Props) => (
  <Icon {...p}>
    <rect x="3.5" y="4.5" width="17" height="15" rx="3" />
    <path d="M9.5 4.5v15" />
  </Icon>
)

export const GearIcon = (p: Props) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-2.87 1.2v.17a2 2 0 1 1-4 0v-.09A1.7 1.7 0 0 0 8.9 19.4a1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 3 15.1a1.7 1.7 0 0 0-1.55-1.02H1.3a2 2 0 1 1 0-4h.09A1.7 1.7 0 0 0 3 8.9a1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 8.36 3h.08A1.7 1.7 0 0 0 10 1.45V1.3a2 2 0 1 1 4 0v.09A1.7 1.7 0 0 0 15.1 3a1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 21 8.36v.08a1.7 1.7 0 0 0 1.55 1.56h.15a2 2 0 1 1 0 4h-.09A1.7 1.7 0 0 0 19.4 15" />
  </Icon>
)

export const ShieldIcon = (p: Props) => (
  <Icon {...p}>
    <path d="M12 3.5 5.5 6v5.5c0 4.2 2.7 7.4 6.5 9 3.8-1.6 6.5-4.8 6.5-9V6z" />
    <path d="m9.3 12.2 2 2 3.6-3.8" />
  </Icon>
)

export const UsersIcon = (p: Props) => (
  <Icon {...p}>
    <circle cx="9" cy="8.5" r="3.5" />
    <path d="M3 20c.6-3.4 3-5.3 6-5.3s5.4 1.9 6 5.3" />
    <path d="M16.5 5.6a3.4 3.4 0 0 1 0 6.6M18 14.9c2.1.6 3.3 2.4 3.7 5.1" />
  </Icon>
)

export const ChartIcon = (p: Props) => (
  <Icon {...p}>
    <path d="M4 20h16" />
    <path d="M7 20v-6M12 20V6M17 20v-9" />
  </Icon>
)

export const ChevronLeftIcon = (p: Props) => (
  <Icon {...p}>
    <path d="M14.5 5.5 8 12l6.5 6.5" strokeWidth="2" />
  </Icon>
)

export const ChevronRightIcon = (p: Props) => (
  <Icon {...p}>
    <path d="M9.5 5.5 16 12l-6.5 6.5" strokeWidth="2" />
  </Icon>
)

export const ChatIcon = (p: Props) => (
  <Icon {...p}>
    <path d="M5.2 17.4A8 8 0 1 1 8.6 19L4 20.5z" />
  </Icon>
)

export const XIcon = (p: Props) => (
  <Icon {...p}>
    <path d="m6 6 12 12M18 6 6 18" strokeWidth="2" />
  </Icon>
)

export const MoonIcon = (p: Props) => (
  <Icon {...p}>
    <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5" />
  </Icon>
)

export const SunIcon = (p: Props) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6 7 7M17 17l1.4 1.4M18.4 5.6 17 7M7 17l-1.4 1.4" />
  </Icon>
)

export const LogoutIcon = (p: Props) => (
  <Icon {...p}>
    <path d="M15 5.5H7A2.5 2.5 0 0 0 4.5 8v8A2.5 2.5 0 0 0 7 18.5h8" />
    <path d="M13.5 8.5 17 12l-3.5 3.5M17 12H9" />
  </Icon>
)

export const KeyIcon = (p: Props) => (
  <Icon {...p}>
    <circle cx="8" cy="12" r="3.5" />
    <path d="M11.5 12H20M17 12v3M14.5 12v2.5" />
  </Icon>
)

export const StarIcon = (p: Props) => (
  <Icon {...p}>
    <path d="m12 4.5 2.3 4.9 5.2.7-3.8 3.7 1 5.2-4.7-2.6-4.7 2.6 1-5.2L4.5 10l5.2-.7z" />
  </Icon>
)

export const InboxIcon = (p: Props) => (
  <Icon {...p}>
    <path d="M3.5 13.5 6 5.5h12l2.5 8v4A1.5 1.5 0 0 1 19 19H5a1.5 1.5 0 0 1-1.5-1.5z" />
    <path d="M3.5 13.5H9l1 2h4l1-2h5.5" />
  </Icon>
)
