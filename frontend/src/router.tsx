import { createBrowserRouter } from 'react-router-dom'
import { Layout } from './components/Layout'
import { EvaluationDetailPage } from './pages/EvaluationDetailPage'
import { EvaluationsPage } from './pages/EvaluationsPage'
import { HomePage } from './pages/HomePage'
import { RoleplayMeetingPage } from './pages/RoleplayMeetingPage'
import { RoleplayPage } from './pages/RoleplayPage'
import { RoleplaySetupPage } from './pages/RoleplaySetupPage'
import { SettingsPage } from './pages/SettingsPage'

export const router = createBrowserRouter([
  {
    path: '/roleplay/:sessionId',
    element: <RoleplayMeetingPage />,
  },
  {
    path: '/',
    element: <Layout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'settings', element: <SettingsPage /> },
      { path: 'roleplay', element: <RoleplayPage /> },
      { path: 'roleplay/setup', element: <RoleplaySetupPage /> },
      { path: 'evaluations', element: <EvaluationsPage /> },
      { path: 'evaluations/:id', element: <EvaluationDetailPage /> },
    ],
  },
])
