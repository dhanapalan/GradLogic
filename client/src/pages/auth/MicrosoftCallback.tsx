import { useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import toast from "react-hot-toast";
import api from "../../lib/api";
import { authActions } from "../../stores/authStore";
import { getLandingPath, getWorkflowRedirectUrl } from "../../components/ProtectedRoute";
import { Loader2 } from "lucide-react";

export default function MicrosoftCallback() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const code = searchParams.get("code");
    const stateFromUrl = searchParams.get("state");
    const processed = useRef(false);

    useEffect(() => {
        if (!code) {
            toast.error("Invalid Microsoft Login callback");
            navigate("/auth/login");
            return;
        }

        // Verify CSRF state: must match what was stored before the redirect
        const storedState = sessionStorage.getItem("ms_oauth_state");
        sessionStorage.removeItem("ms_oauth_state");
        if (!storedState || storedState !== stateFromUrl) {
            toast.error("Invalid OAuth state. Please try signing in again.");
            navigate("/auth/login");
            return;
        }

        if (processed.current) return;
        processed.current = true;

        const exchangeCodeForToken = async () => {
            try {
                const { data } = await api.post("/auth/microsoft", { code, state: stateFromUrl });
                if (data.success && data.data) {
                    const { accessToken, refreshToken, permissions, user } = data.data;
                    authActions.login(accessToken, user, refreshToken, permissions ?? []);
                    toast.success("Login successful");

                    setTimeout(() => {
                        const landingPath = getLandingPath(user);
                        const workflowRedirect = getWorkflowRedirectUrl(user, landingPath);

                        if (workflowRedirect) {
                            window.location.replace(workflowRedirect);
                            return;
                        }
                        navigate(landingPath);
                    }, 100);
                } else {
                    throw new Error("No token received");
                }
            } catch (err: any) {
                toast.error(err.response?.data?.error || err.response?.data?.message || "Microsoft Login failed");
                navigate("/auth/login");
            }
        };

        exchangeCodeForToken();
    }, [code, navigate]);

    return (
        <div className="flex min-h-screen items-center justify-center bg-slate-50">
            <div className="flex flex-col items-center gap-4">
                <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
                <p className="text-sm font-medium text-slate-600">Completing sign in...</p>
            </div>
        </div>
    );
}
