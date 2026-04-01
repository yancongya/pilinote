import { useEffect, useRef } from 'react'

interface GeetestCaptchaProps {
  captchaParams: {
    token: string
    gt: string
    challenge: string
  }
  onSuccess: (captchaData: { challenge: string; validate: string; seccode: string }) => void
  onError?: (error: string) => void
}

declare global {
  interface Window {
    initGeetest: any
  }
}

function GeetestCaptcha({ captchaParams, onSuccess, onError }: GeetestCaptchaProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // 动态加载Geetest脚本
    const script = document.createElement('script')
    script.src = 'https://static.geetest.com/static/js/gt.0.4.9.js'
    script.async = true
    document.body.appendChild(script)

    script.onload = () => {
      initGeetestCaptcha()
    }

    script.onerror = () => {
      onError?.('Geetest脚本加载失败')
    }

    return () => {
      // 清理脚本
      if (script.parentNode) {
        script.parentNode.removeChild(script)
      }
    }
  }, [])

  const initGeetestCaptcha = () => {
    try {
      const { gt, challenge } = captchaParams

      // 初始化Geetest
      if (window.initGeetest) {
        window.initGeetest(
          {
            gt,
            challenge,
            offline: false,
            new_captcha: true,
            product: 'bind',
            width: '300px',
            lang: 'zh-cn',
            https: true,
          },
          (captchaObj: any) => {
            captchaObj
              .onReady(() => {
                captchaObj.verify()
              })
              .onSuccess(() => {
                const result = captchaObj.getValidate()
                const validate = result.geetest_validate
                const seccode = result.geetest_seccode
                
                onSuccess({
                  challenge,
                  validate,
                  seccode,
                })
              })
              .onError((err: any) => {
                onError?.(err.msg || '验证码错误')
              })
          }
        )
      }
    } catch (error) {
      onError?.(error instanceof Error ? error.message : '验证码初始化失败')
    }
  }

  return <div ref={containerRef} id="geetest-container" className="geetest-container" />
}

export default GeetestCaptcha