/**
 * Root router. SessionProvider wraps everything so any route can read the
 * current Supabase session. ``/`` is guarded; ``/login`` is public and
 * auto-redirects when a session is already present.
 */

import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import { RequireAuth } from "@/auth/RequireAuth";
import { SessionProvider } from "@/auth/SessionProvider";
import { ChatPage } from "@/pages/ChatPage";
import { LoginPage } from "@/pages/LoginPage";

function App() {
  return (
    <SessionProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/"
            element={
              <RequireAuth>
                <ChatPage />
              </RequireAuth>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </SessionProvider>
  );
}

export default App;
