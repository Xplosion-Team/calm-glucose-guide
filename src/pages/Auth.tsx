import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Leaf, Loader2, Phone, Mail, Eye, EyeOff } from "lucide-react";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";

const E164_REGEX = /^\+[1-9]\d{7,14}$/;
const RESEND_COOLDOWN_SEC = 30;

const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [authMethod, setAuthMethod] = useState<"email" | "phone">("email");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [phone, setPhone] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) navigate("/");
    });
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) navigate("/");
    });
    return () => subscription.unsubscribe();
  }, [navigate]);

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

  const normalizePhone = (raw: string) => {
    const trimmed = raw.replace(/[\s\-\(\)\.]/g, "");
    return trimmed.startsWith("+") ? trimmed : `+${trimmed.replace(/^0+/, "")}`;
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      toast({ title: "Email required", description: "Please enter your email address.", variant: "destructive" });
      return;
    }
    if (password.length < 6) {
      toast({ title: "Password too short", description: "Use at least 6 characters.", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) {
          // Friendly message for the most common cause
          const msg = /invalid login credentials/i.test(error.message)
            ? "That email and password don't match. Please try again."
            : error.message;
          throw new Error(msg);
        }
      } else {
        const { error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { emailRedirectTo: `${window.location.origin}/` },
        });
        if (error) throw error;
        toast({
          title: "Check your email",
          description: "We sent you a confirmation link. Please verify your email to continue.",
        });
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const sendCode = async () => {
    const normalized = normalizePhone(phone);
    if (!E164_REGEX.test(normalized)) {
      toast({
        title: "Invalid phone number",
        description: "Use international format with country code, e.g. +14155551234.",
        variant: "destructive",
      });
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-otp", {
        body: { phone: normalized },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setPhone(normalized);
      setOtpSent(true);
      setOtpCode("");
      setResendCooldown(RESEND_COOLDOWN_SEC);
      toast({ title: "Code sent", description: "Check your phone for a 6-digit verification code." });
    } catch (err: any) {
      toast({ title: "Couldn't send code", description: err.message || "Failed to send code", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    await sendCode();
  };

  const handleResend = async () => {
    if (resendCooldown > 0) return;
    await sendCode();
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otpCode.length !== 6) {
      toast({ title: "Incomplete code", description: "Please enter all 6 digits.", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("verify-otp", {
        body: { phone, code: otpCode },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      if (data?.session) {
        await supabase.auth.setSession({
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
        });
      } else {
        throw new Error("No session returned. Please try again.");
      }
    } catch (err: any) {
      setOtpCode("");
      toast({ title: "Verification failed", description: err.message || "Invalid code", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const switchAuthMethod = (method: "email" | "phone") => {
    setAuthMethod(method);
    setOtpSent(false);
    setOtpCode("");
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-2">
            <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center">
              <Leaf className="w-7 h-7 text-primary-foreground" aria-hidden="true" />
            </div>
            <h1 className="text-3xl font-bold text-foreground">Greens Health</h1>
          </div>
          <p className="text-muted-foreground text-lg">Your glucose companion</p>
        </div>

        {/* Auth method toggle */}
        <div className="flex gap-2 bg-muted rounded-lg p-1" role="tablist" aria-label="Sign-in method">
          <button
            role="tab"
            aria-selected={authMethod === "email"}
            onClick={() => switchAuthMethod("email")}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-md text-sm font-medium transition-colors ${
              authMethod === "email" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
            }`}
          >
            <Mail className="w-4 h-4" aria-hidden="true" />
            Email
          </button>
          <button
            role="tab"
            aria-selected={authMethod === "phone"}
            onClick={() => switchAuthMethod("phone")}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-md text-sm font-medium transition-colors ${
              authMethod === "phone" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
            }`}
          >
            <Phone className="w-4 h-4" aria-hidden="true" />
            Phone
          </button>
        </div>

        {authMethod === "email" ? (
          <>
            <form onSubmit={handleEmailSubmit} className="space-y-5" noValidate>
              <div className="space-y-2">
                <Label htmlFor="email" className="text-lg">Email</Label>
                <Input
                  id="email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  className="h-14 text-lg"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password" className="text-lg">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete={isLogin ? "current-password" : "new-password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    minLength={6}
                    className="h-14 text-lg pr-12"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute inset-y-0 right-0 flex items-center justify-center w-12 text-muted-foreground hover:text-foreground"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                {!isLogin && (
                  <p className="text-sm text-muted-foreground">At least 6 characters.</p>
                )}
              </div>
              <Button type="submit" className="w-full h-14 text-lg" disabled={loading}>
                {loading && <Loader2 className="w-5 h-5 mr-2 animate-spin" aria-hidden="true" />}
                {isLogin ? "Sign In" : "Create Account"}
              </Button>
            </form>

            <p className="text-center text-muted-foreground">
              {isLogin ? "Don't have an account?" : "Already have an account?"}{" "}
              <button
                type="button"
                onClick={() => { setIsLogin(!isLogin); setShowPassword(false); }}
                className="text-primary underline font-medium"
              >
                {isLogin ? "Sign up" : "Sign in"}
              </button>
            </p>
          </>
        ) : (
          <>
            {!otpSent ? (
              <form onSubmit={handleSendOtp} className="space-y-5" noValidate>
                <div className="space-y-2">
                  <Label htmlFor="phone" className="text-lg">Phone Number</Label>
                  <Input
                    id="phone"
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+1 415 555 1234"
                    required
                    className="h-14 text-lg"
                  />
                  <p className="text-sm text-muted-foreground">
                    Include your country code (e.g. +1 for US, +44 for UK).
                  </p>
                </div>
                <Button type="submit" className="w-full h-14 text-lg" disabled={loading}>
                  {loading && <Loader2 className="w-5 h-5 mr-2 animate-spin" aria-hidden="true" />}
                  Send Verification Code
                </Button>
              </form>
            ) : (
              <form onSubmit={handleVerifyOtp} className="space-y-5" noValidate>
                <div className="space-y-3">
                  <Label className="text-lg">Enter verification code</Label>
                  <p className="text-sm text-muted-foreground">
                    We sent a 6-digit code to{" "}
                    <span className="font-medium text-foreground">{phone}</span>
                  </p>
                  <div className="flex justify-center">
                    <InputOTP maxLength={6} value={otpCode} onChange={setOtpCode} autoFocus>
                      <InputOTPGroup>
                        <InputOTPSlot index={0} />
                        <InputOTPSlot index={1} />
                        <InputOTPSlot index={2} />
                        <InputOTPSlot index={3} />
                        <InputOTPSlot index={4} />
                        <InputOTPSlot index={5} />
                      </InputOTPGroup>
                    </InputOTP>
                  </div>
                </div>
                <Button type="submit" className="w-full h-14 text-lg" disabled={loading || otpCode.length !== 6}>
                  {loading && <Loader2 className="w-5 h-5 mr-2 animate-spin" aria-hidden="true" />}
                  Verify & Sign In
                </Button>
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => { setOtpSent(false); setOtpCode(""); }}
                    className="text-sm text-muted-foreground underline"
                  >
                    Use a different number
                  </button>
                  <button
                    type="button"
                    onClick={handleResend}
                    disabled={resendCooldown > 0 || loading}
                    className="text-sm text-primary underline disabled:opacity-50 disabled:no-underline"
                  >
                    {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "Resend code"}
                  </button>
                </div>
              </form>
            )}
          </>
        )}

        <p className="text-center text-xs text-muted-foreground leading-relaxed">
          By continuing, you agree to our friendly use policy.
          This app is your health companion, not medical advice.
        </p>
      </div>
    </div>
  );
};

export default Auth;
