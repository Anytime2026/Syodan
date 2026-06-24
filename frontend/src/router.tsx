import { createBrowserRouter, Navigate } from 'react-router-dom'
import { Layout } from './components/Layout'
import { EvaluationDetailPage } from './pages/EvaluationDetailPage'
import { EvaluationsPage } from './pages/EvaluationsPage'
import { HomePage } from './pages/HomePage'
import { RoleplayMeetingPage } from './pages/RoleplayMeetingPage'
import { SettingsPage } from './pages/SettingsPage'
import { PreSessionPage } from './pages/PreSessionPage'
import { OverallReviewPage } from './pages/OverallReviewPage'
import { ReviewerEvaluationPage } from './pages/ReviewerEvaluationPage'
import { ReviewerOverallReviewPage } from './pages/ReviewerOverallReviewPage'

export const router = createBrowserRouter([
  {
    path: '/roleplay/:sessionId',
    element: <RoleplayMeetingPage />,
  },
  {
    path: '/reviewer/evaluations/:token',
    element: <ReviewerEvaluationPage />,
  },
  {
    path: '/reviewer/overall-review/:token',
    element: <ReviewerOverallReviewPage />,
  },
  {
    path: '/',
    element: <Layout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'settings', element: <SettingsPage /> },
      { path: 'pre-session', element: <PreSessionPage /> },
      { path: 'roleplay/setup', element: <Navigate to="/settings" replace /> },
      { path: 'evaluations', element: <EvaluationsPage /> },
      { path: 'evaluations/:id', element: <EvaluationDetailPage /> },
      { path: 'overall-review', element: <OverallReviewPage /> },
    ],
  },
])
