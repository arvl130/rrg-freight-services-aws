import React from "react"
import type { SQSEvent } from "aws-lambda"
import { render } from "@react-email/render"
import PackageStatusUpdateEmail from "./email-templates/package-status-update-email"
import OtpEmail from "./email-templates/otp-email"
import OutForDeliveryMonitoringLinkEmail from "./email-templates/out-for-delivery-monitoring-link-email"

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
  id: string
  otp: string
  validityMessage?: string
}

type OutForDeliveryMonitoringLinkEmailComponentProps = {
  type: "out-for-delivery-monitoring-link"
  receiverFullName: string
  driverFullName: string
  driverContactNumber: string
  packageId: string
  accessKey: string
}

type ComponentProps =
  | PackageStatusUpdateEmailComponentProps
  | OtpEmailComponentProps
  | OutForDeliveryMonitoringLinkEmailComponentProps

type MessageBodyJSON = {
  to: string
  subject: string
  componentProps: ComponentProps
}

export async function handler(event: SQSEvent) {
  const messageIds = event.Records.map((record) => record.messageId)

  console.log(
    `Processing message ${messageIds.length} IDs: ${messageIds.join(", ")}`
  )

  try {
    console.log("Building request body ...")
    const body = JSON.stringify(
      event.Records.map((record) => {
        console.log(
          `Unparsed message body of ${record.messageId}:`,
          record.body
        )

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
        } else if (componentProps.type === "out-for-delivery-monitoring-link") {
          return {
            from: `RRG Freight Services Updates <${process.env.MAIL_FROM_URL}>`,
            to,
            subject,
            html: render(
              <OutForDeliveryMonitoringLinkEmail
                receiverFullName={componentProps.receiverFullName}
                driverFullName={componentProps.driverFullName}
                driverContactNumber={componentProps.driverContactNumber}
                packageId={componentProps.packageId}
                accessKey={componentProps.accessKey}
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
            html: render(
              <OtpEmail
                id={componentProps.id}
                otp={componentProps.otp}
                validityMessage={componentProps.validityMessage}
              />,
              {
                pretty: true,
              }
            ),
          }
        }
      })
    )
    console.log("Request body built.")

    console.log("Making request ...")
    const response = await fetch("https://api.resend.com/emails/batch", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      },
      body,
    })
    console.log("Request made.")

    if (response.ok) {
      console.log("Response is OK.")
      const body = await response.json()

      return {
        statusCode: 200,
        body,
      }
    } else {
      console.log("Response is not OK:", response.status)
      const body = await response.json()
      console.log("JSON response body", body)

      return {
        statusCode: response.status,
        body,
      }
    }
  } catch (e) {
    if (e instanceof Error) {
      console.log("Function failed with error:", e.message)

      return {
        statusCode: 500,
        body: e.message,
      }
    } else {
      return {
        statusCode: 500,
      }
    }
  }
}
