import "dotenv/config"
import { Construct } from "constructs"
import * as cdk from "aws-cdk-lib"
import * as sqs from "aws-cdk-lib/aws-sqs"
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs"
import * as lambda from "aws-cdk-lib/aws-lambda"
import * as lambdaEventSources from "aws-cdk-lib/aws-lambda-event-sources"

export class RrgFreightServicesAwsStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props)

    if (!process.env.RESEND_API_KEY)
      throw new Error("Invalid environment variable: RESEND_API_KEY")
    if (!process.env.MAIL_FROM_URL)
      throw new Error("Invalid environment variable: MAIL_FROM_URL")
    if (!process.env.SEMAPHORE_API_URL)
      throw new Error("Invalid environment variable: SEMAPHORE_API_URL")
    if (!process.env.SEMAPHORE_API_KEY)
      throw new Error("Invalid environment variable: SEMAPHORE_API_KEY")

    const emailQueue = new sqs.Queue(this, "email-queue", {
      queueName: "email-queue",
      visibilityTimeout: cdk.Duration.seconds(300),
    })
    const smsQueue = new sqs.Queue(this, "sms-queue", {
      queueName: "sms-queue",
      visibilityTimeout: cdk.Duration.seconds(300),
    })

    const emailFn = new NodejsFunction(this, "consumer-lambda", {
      entry: "lambda/consumer.tsx",
      handler: "handler",
      runtime: lambda.Runtime.NODEJS_20_X,
      environment: {
        RESEND_API_KEY: process.env.RESEND_API_KEY,
        MAIL_FROM_URL: process.env.MAIL_FROM_URL,
      },
      timeout: cdk.Duration.minutes(5),
      memorySize: 1024,
    })

    const smsFn = new NodejsFunction(this, "sms-consumer-lambda", {
      entry: "lambda/sms-consumer.ts",
      handler: "handler",
      runtime: lambda.Runtime.NODEJS_20_X,
      environment: {
        SEMAPHORE_API_URL: process.env.SEMAPHORE_API_URL,
        SEMAPHORE_API_KEY: process.env.SEMAPHORE_API_KEY,
      },
      timeout: cdk.Duration.minutes(5),
    })

    const emailEventSource = new lambdaEventSources.SqsEventSource(emailQueue, {
      // Process only up to 10 messages, every time the lambda is invoked.
      batchSize: 10,
    })
    emailFn.addEventSource(emailEventSource)

    const smsEventSource = new lambdaEventSources.SqsEventSource(smsQueue, {
      // Process only up to 10 messages, every time the lambda is invoked.
      batchSize: 10,
    })
    smsFn.addEventSource(smsEventSource)
  }
}
