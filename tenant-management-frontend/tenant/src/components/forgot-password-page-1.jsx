import { Button } from '@/components/ui/button'
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp'
import { Eye, EyeOff, Lock, Mail } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../../plugins/axios'

const ForgotPasswordPage1 = () => {
  const navigate = useNavigate()
  const [step, setStep] = useState(1)
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [resetToken, setResetToken] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const calculatePasswordStrength = (password) => {
    let strength = 0
    if (password.length >= 8) strength += 25
    if (/[A-Z]/.test(password)) strength += 25
    if (/[0-9]/.test(password)) strength += 25
    if (/[^A-Za-z0-9]/.test(password)) strength += 25
    return strength
  }

  const handleSendCode = async () => {
    setError('')
    setLoading(true)
    try {
      await api.post('/api/auth/forgot-password', { email })
      setStep(2)
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to send reset code')
    } finally {
      setLoading(false)
    }
  }

  const handleVerifyCode = async () => {
    setError('')
    setLoading(true)
    try {
      const { data } = await api.post('/api/auth/verify-reset-code', { email, code })
      setResetToken(data.resetToken)
      setStep(3)
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid or expired code')
    } finally {
      setLoading(false)
    }
  }

  const handleResendCode = async () => {
    setError('')
    setCode('')
    setLoading(true)
    try {
      await api.post('/api/auth/forgot-password', { email })
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to resend code')
    } finally {
      setLoading(false)
    }
  }

  const handleResetPassword = async () => {
    setError('')
    setLoading(true)
    try {
      await api.post('/api/auth/reset-password', { email, resetToken, newPassword: password })
      setStep(4)
    } catch (err) {
      setError(err.response?.data?.message || 'Password reset failed')
    } finally {
      setLoading(false)
    }
  }

  const renderStepContent = () => {
    switch (step) {
      case 1:
        return (
          <>
            <CardHeader className='pt-0 text-center'>
              <CardTitle className='text-2xl'>Forgot password?</CardTitle>
              <CardDescription>Enter your email address to reset your password</CardDescription>
            </CardHeader>
            <div className='flex flex-col gap-6'>
              <div className='relative'>
                <Input
                  id='email-forgot-lp3-style'
                  type='email'
                  placeholder='me@example.com'
                  className='bg-transparent ps-10 h-9 text-sm'
                  autoComplete='email'
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && email && handleSendCode()}
                  required />
                <Mail className='text-muted-foreground absolute start-3 top-1/2 size-5 -translate-y-1/2' />
              </div>
              {error && <p className='text-destructive text-sm text-center'>{error}</p>}
              <Button
                type='button'
                className="h-9 px-4 py-2 w-full cursor-pointer"
                onClick={handleSendCode}
                disabled={!email || loading}>
                {loading ? 'Sending…' : 'Send Reset Code'}
              </Button>
              <p className='mt-6 flex justify-center gap-1 text-center text-sm'>
                <span>Remember your password?</span>
                <button
                  type='button'
                  className='underline underline-offset-4 cursor-pointer'
                  onClick={() => navigate('/login')}>
                  Sign In
                </button>
              </p>
            </div>
          </>
        )

      case 2:
        return (
          <>
            <div className='mb-6 text-center'>
              <h1 className='mb-2 text-2xl font-bold tracking-tight text-balance'>Check Your Email</h1>
              <p className='text-muted-foreground text-sm text-balance'>
                Enter the 6-digit code sent to{' '}
                <span className='text-foreground font-medium'>{email}</span>.
              </p>
            </div>
            <div className='flex flex-col gap-6'>
              <InputOTP maxLength={6} value={code} onChange={value => { setCode(value); setError('') }}>
                <InputOTPGroup className='grid w-full grid-cols-6 gap-2 sm:gap-3'>
                  <InputOTPSlot index={0} className='h-12 w-auto flex-1 rounded-md border-l text-lg' />
                  <InputOTPSlot index={1} className='h-12 w-auto flex-1 rounded-md border-l text-lg' />
                  <InputOTPSlot index={2} className='h-12 w-auto flex-1 rounded-md border-l text-lg' />
                  <InputOTPSlot index={3} className='h-12 w-auto flex-1 rounded-md border-l text-lg' />
                  <InputOTPSlot index={4} className='h-12 w-auto flex-1 rounded-md border-l text-lg' />
                  <InputOTPSlot index={5} className='h-12 w-auto flex-1 rounded-md border-l text-lg' />
                </InputOTPGroup>
              </InputOTP>
              {error && <p className='text-destructive text-sm text-center'>{error}</p>}
              <Button
                type='button'
                className="h-9 px-4 py-2 w-full cursor-pointer"
                onClick={handleVerifyCode}
                disabled={code.length < 6 || loading}>
                {loading ? 'Verifying…' : 'Verify Code'}
              </Button>
              <p className='text-muted-foreground text-center text-sm'>
                Didn't receive it?{' '}
                <Button
                  variant='link'
                  className='cursor-pointer px-1 font-medium underline underline-offset-4 hover:underline'
                  onClick={handleResendCode}
                  disabled={loading}>
                  Resend Code
                </Button>
              </p>
            </div>
          </>
        )

      case 3: {
        const strength = calculatePasswordStrength(password)
        return (
          <>
            <div className='mb-6 text-center'>
              <h1 className='mb-2 text-2xl font-bold tracking-tight text-balance'>Create New Password</h1>
              <p className='text-muted-foreground text-sm text-balance'>
                Choose a strong password for account security.
              </p>
            </div>
            <div className='flex flex-col gap-6'>
              <div className='relative'>
                <Input
                  id='new-password-forgot-lp3-style'
                  type={showPassword ? 'text' : 'password'}
                  placeholder='Enter new password'
                  className='bg-transparent ps-10 text-sm'
                  autoComplete='new-password'
                  value={password}
                  onChange={e => { setPassword(e.target.value); setError('') }}
                  required />
                <Lock className='text-muted-foreground absolute start-3 top-1/2 size-5 -translate-y-1/2' />
                <Button
                  type='button'
                  variant='ghost'
                  size='icon'
                  className="size-9 text-muted-foreground absolute end-1 top-1/2 -translate-y-1/2 cursor-pointer hover:bg-transparent"
                  onClick={() => setShowPassword(prev => !prev)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}>
                  {showPassword ? <EyeOff /> : <Eye />}
                </Button>
              </div>
              <div className='flex flex-col gap-1'>
                <Progress value={strength} className='h-2' aria-label='Password strength indicator' />
                <small className='text-muted-foreground block text-end text-xs'>
                  {strength === 0 ? '' : strength < 50 ? 'Weak' : strength < 75 ? 'Medium' : 'Strong'}
                </small>
              </div>
              {error && <p className='text-destructive text-sm text-center'>{error}</p>}
              <Button
                type='button'
                className="h-9 px-4 py-2 w-full cursor-pointer"
                onClick={handleResetPassword}
                disabled={strength < 75 || loading}>
                {loading ? 'Resetting…' : 'Set New Password'}
              </Button>
            </div>
          </>
        )
      }

      case 4:
        return (
          <>
            <CardHeader className='mb-4 pt-0 text-center'>
              <CardTitle className='text-2xl'>Password Reset!</CardTitle>
              <CardDescription>Your password has been reset successfully.</CardDescription>
            </CardHeader>
            <CardFooter>
              <Button
                className="h-9 px-4 py-2 w-full cursor-pointer"
                onClick={() => navigate('/login')}>
                Back to Login
              </Button>
            </CardFooter>
          </>
        )

      default:
        return null
    }
  }

  return (
    <section
      className='from-background to-muted/50 relative isolate flex min-h-dvh w-full items-center justify-center overflow-hidden bg-linear-to-br'>
      <div
        className='relative z-10 container mx-auto flex min-h-dvh items-center justify-center px-4 py-12 sm:py-16'>
        <Card
          className='bg-background/80 relative w-full max-w-md ring-0 p-6 shadow-2xl backdrop-blur-md sm:p-8'>
          <div className='my-4 flex justify-center'>
            <div className='bg-secondary relative size-14 rounded-full border'>
              <div className='flex h-full items-center justify-center'>
                <svg
                  width='32'
                  height='32'
                  viewBox='0 0 32 32'
                  fill='none'
                  xmlns='http://www.w3.org/2000/svg'>
                  <path
                    d='M26 24.75C26.4142 24.75 26.75 24.4142 26.75 24C26.75 23.5858 26.4142 23.25 26 23.25V24.75ZM26 23.25H11V24.75H26V23.25ZM8.75 21V15H7.25V21H8.75ZM11 23.25C9.75736 23.25 8.75 22.2426 8.75 21H7.25C7.25 23.0711 8.92893 24.75 11 24.75V23.25Z'
                    fill='currentColor' />
                  <path
                    d='M1.5 3.25C1.08579 3.25 0.75 3.58579 0.75 4C0.75 4.41421 1.08579 4.75 1.5 4.75V3.25ZM1.5 4.75H6V3.25H1.5V4.75ZM7.25 6V21H8.75V6H7.25ZM6 4.75C6.69036 4.75 7.25 5.30964 7.25 6H8.75C8.75 4.48122 7.51878 3.25 6 3.25V4.75Z'
                    fill='currentColor' />
                  <path
                    d='M22 21.75C22.4142 21.75 22.75 21.4142 22.75 21C22.75 20.5858 22.4142 20.25 22 20.25V21.75ZM22 20.25H11V21.75H22V20.25ZM8.75 18V12H7.25V18H8.75ZM11 20.25C9.75736 20.25 8.75 19.2426 8.75 18H7.25C7.25 20.0711 8.92893 21.75 11 21.75V20.25Z'
                    fill='currentColor' />
                  <path
                    d='M27.2057 19.754C27.0654 20.1438 26.6357 20.346 26.246 20.2057C25.8562 20.0654 25.654 19.6357 25.7943 19.246L27.2057 19.754ZM30.0361 9.67744L29.3305 9.4234L29.3305 9.4234L30.0361 9.67744ZM25.7943 19.246L29.3305 9.4234L30.7418 9.93148L27.2057 19.754L25.7943 19.246ZM28.1543 7.75L8 7.75V6.25L28.1543 6.25V7.75ZM29.3305 9.4234C29.6237 8.60882 29.0201 7.75 28.1543 7.75V6.25C30.059 6.25 31.3869 8.13941 30.7418 9.93148L29.3305 9.4234Z'
                    fill='currentColor' />
                  <path
                    d='M13.5 21.75C13.0858 21.75 12.75 21.4142 12.75 21C12.75 20.5858 13.0858 20.25 13.5 20.25V21.75ZM26.7111 19.009L27.4174 19.2613L27.4174 19.2613L26.7111 19.009ZM13.5 20.25H23.8858V21.75H13.5V20.25ZM26.0048 18.7568L27.7937 13.7477L29.2063 14.2523L27.4174 19.2613L26.0048 18.7568ZM23.8858 20.25C24.8367 20.25 25.6849 19.6522 26.0048 18.7568L27.4174 19.2613C26.8843 20.7537 25.4706 21.75 23.8858 21.75V20.25Z'
                    fill='currentColor' />
                  <path d='M21.1694 10.5806L14.5651 17.1849' stroke='currentColor' />
                  <path d='M22.1694 14.5806L18.5632 18.1868' stroke='currentColor' />
                  <circle cx='13.1' cy='26.1' r='1.7' stroke='currentColor' />
                  <circle cx='22.1' cy='26.1' r='1.7' stroke='currentColor' />
                </svg>
              </div>
            </div>
          </div>

          {renderStepContent()}
        </Card>
      </div>
    </section>
  )
}

export default ForgotPasswordPage1
