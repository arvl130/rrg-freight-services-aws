import type { SQSEvent } from "aws-lambda"

type MessageBodyJSON = {
  to: string
  body: string
}

export async function handler(event: SQSEvent) {
  const messageIds = event.Records.map((record) => record.messageId)
  console.log(
    `Processing message ${messageIds.length} IDs: ${messageIds.join(", ")}`
  )

  try {
    console.log("Making requests ...")
    const result = await Promise.allSettled(
      event.Records.map((record) => {
        console.log(
          `Unparsed message body of ${record.messageId}:`,
          record.body
        )

        const { to, body } = JSON.parse(record.body) as MessageBodyJSON
        return fetch(
          `${process.env.SEMAPHORE_API_URL}/messages?apikey=${
            process.env.SEMAPHORE_API_KEY
          }&number=${encodeURIComponent(to)}&message=${encodeURIComponent(
            body
          )}`,
          {
            method: "POST",
          }
        )
      })
    )
    console.log("All requests done.")

    const succededResults = result.filter(
      (el): el is PromiseFulfilledResult<Response> => el.status === "fulfilled"
    )
    const succedeedJsons = await Promise.all(
      succededResults.map((s) => s.value.json())
    )
    const failedResults = result.filter(
      (el): el is PromiseRejectedResult => el.status === "rejected"
    )

    const body = {
      succedeedJsons,
      failedCount: failedResults.length,
    }

    console.log("Success/Failure:", body)
    return {
      statusCode: 200,
      body,
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
