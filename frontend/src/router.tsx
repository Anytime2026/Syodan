import { createBrowserRouter } from 'react-router-dom'
import { Layout } from './components/Layout'
import { EvaluationDetailPage } from './pages/EvaluationDetailPage'
import { EvaluationsPage } from './pages/EvaluationsPage'
import { HomePage } from './pages/HomePage'
import { RoleplayPage } from './pages/RoleplayPage'
import { SettingsPage } from './pages/SettingsPage'
import { PreSessionPage } from './pages/PreSessionPage'
import { OverallReviewPage } from './pages/OverallReviewPage'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <Layout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'settings', element: <SettingsPage /> },
      { path: 'pre-session', element: <PreSessionPage /> },
      { path: 'roleplay', element: <RoleplayPage /> },
      { path: 'evaluations', element: <EvaluationsPage /> },
      { path: 'evaluations/:id', element: <EvaluationDetailPage /> },
      { path: 'overall-review', element: <OverallReviewPage /> },
    ],
  },
])
