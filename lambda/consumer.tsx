import React from "react"
import type { SQSEvent } from "aws-lambda"
import { render } from "@react-email/render"
import PackageStatusUpdateEmail from "./email-templates/package-status-update-email"
import OtpEmail from "./email-templates/otp-email"

type PackageStatusUpdateEmailComponentProps = {
  type: "package-status-update"
  body: string
  callToAction: {
    label: string
    href: string
  }
}

type OtpEmailComponentProps = {
  type: "otp"
  otp: string
}

type ComponentProps =
  | PackageStatusUpdateEmailComponentProps
  | OtpEmailComponentProps

type MessageBodyJSON = {
  to: string
  subject: string
  componentProps: ComponentProps
}

export async function handler(event: SQSEvent) {
  const messageIds = event.Records.map((record) => record.messageId)

  console.log(`Processing message IDs: ${messageIds.join(", ")}`)
  const response = await fetch("https://api.resend.com/emails/batch", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
    },
    body: JSON.stringify(
      event.Records.map((record) => {
        const { to, subject, componentProps } = JSON.parse(
          record.body
        ) as MessageBodyJSON

        if (componentProps.type === "package-status-update") {
          return {
            from: `RRG Freight Services Updates <${process.env.MAIL_FROM_URL}>`,
            to,
            subject,
            html: render(
              <PackageStatusUpdateEmail
                body={componentProps.body}
                callToAction={{
                  label: componentProps.callToAction.label,
                  href: componentProps.callToAction.href,
                }}
              />,
              {
                pretty: true,
              }
            ),
          }
        } else {
          return {
            from: `RRG Freight Services Updates <${process.env.MAIL_FROM_URL}>`,
            to,
            subject,
            html: render(<OtpEmail otp={componentProps.otp} />, {
              pretty: true,
            }),
          }
        }
      })
    ),
  })

  if (response.ok) {
    const body = await response.json()

    return {
      statusCode: 200,
      body,
    }
  } else {
    const body = await response.json()

    return {
      statusCode: response.status,
      body,
    }
  }
}
