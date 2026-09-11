import { NavLink } from 'react-router-dom'
import { cn } from '@/lib/utils'

const links = [
  { to: '/', label: 'Form', end: true },
  { to: '/dashboard', label: 'Dashboard', end: false },
]

function Nav() {
  return (
    <nav className="fixed top-4 right-4 z-10 flex gap-4">
      {links.map(({ to, label, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) =>
            cn(
              'text-sm font-medium',
              isActive
                ? 'text-foreground'
                : 'text-muted-foreground hover:text-foreground',
            )
          }
        >
          {label}
        </NavLink>
      ))}
    </nav>
  )
}

export default Nav
