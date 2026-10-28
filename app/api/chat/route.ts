import { NextResponse } from 'next/server';
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

const SCHEMA_CONTEXT = `
Here is the database schema for the application:

Table: "OrderNumber"
- id: String (UUID)
- orderNumber: String
- centerNumber: String
- city: String
- academyName: String
- examType: String
- examMode: String
- createdAt: DateTime

Table: "TeacherAcademy"
- id: String (UUID)
- uniqueKey: String
- name: String (School/Academy name)
- teacherName: String
- schoolName: String
- primary_email: String
- phone: String
- type: String
- createdAt: DateTime

Table: "Candidate"
- id: String (UUID)
- firstName: String
- lastName: String
- examType: String
- grade: String
- instrument: String
- expectedFee: Float
- paymentStatus: String
- status: String
- sessionMonth: String
- "teacherId": String (FK to "TeacherAcademy"."id")
- "orderNumberId": String (FK to "OrderNumber"."id")
- createdAt: DateTime

Table: "BankTransaction"
- id: String (UUID)
- transactionDate: DateTime
- narration: String
- amount: Float
- reconciledMethod: String
- "reconciledTeacherId": String (FK to "TeacherAcademy"."id")
- status: String
- sessionMonth: String

Important rules for SQL:
1. ALWAYS double quote table names and column names that have camelCase or are reserved keywords (e.g., "Candidate", "teacherId", "firstName"). Do NOT double-quote standard keywords like SELECT or WHERE.
2. Only write SELECT queries.
3. Use ILIKE for case-insensitive matching.
`;

export async function POST(req: Request) {
  try {
    const { message } = await req.json();

    if (!message) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    const model = genAI.getGenerativeModel({
      model: 'gemini-3.6-flash',
      systemInstruction: `You are an AI database assistant. You help the user by answering questions about their database. Use the query_database tool to fetch data. ${SCHEMA_CONTEXT}`,
      tools: [{
        functionDeclarations: [{
          name: "query_database",
          description: "Execute a PostgreSQL SELECT query to fetch data from the database to answer the user's question.",
          parameters: {
            type: SchemaType.OBJECT,
            properties: {
              sql: {
                type: SchemaType.STRING,
                description: "The raw PostgreSQL SELECT query string to execute."
              }
            },
            required: ["sql"]
          }
        }]
      }]
    });

    // We do NOT use startChat to avoid SDK "role" parsing issues with older implementations.
    // Instead, we just pass the user message to generateContent.
    const result = await model.generateContent(message);
    const response = result.response;
    
    let finalMessage = response.text();
    let queryData: any[] = [];
    let executedSql = "";

    const functionCalls = response.functionCalls();
    
    if (functionCalls && functionCalls.length > 0) {
        const call = functionCalls[0];
        if (call.name === 'query_database') {
            const sqlQuery = (call.args as any).sql;
            console.log("Executing Tool SQL:", sqlQuery);
            executedSql = sqlQuery;
            
            try {
                const rawData = await prisma.$queryRawUnsafe(sqlQuery);
                // Convert BigInts to strings for JSON serialization
                queryData = JSON.parse(JSON.stringify(rawData, (key, value) =>
                    typeof value === 'bigint' ? value.toString() : value 
                ));
                
                // Manually trigger a second prompt to get the conversational summary
                // instead of using functionResponse roles, to bypass the Bad Request error.
                const summaryPrompt = `
The user asked: "${message}"

You decided to run the following SQL query:
${sqlQuery}

The database returned this JSON data:
${JSON.stringify(queryData, null, 2)}

Provide a conversational, natural language answer to the user based ONLY on this data. Do not show the JSON block in your reply.`;
                
                const summaryResult = await model.generateContent(summaryPrompt);
                finalMessage = summaryResult.response.text();
            } catch (dbError: any) {
                console.error("DB Query Failed:", dbError);
                finalMessage = "I tried to query the database, but there was an error with my SQL query: " + dbError.message;
            }
        }
    }

    return NextResponse.json({ 
        message: finalMessage,
        data: queryData,
        sql: executedSql
    });

  } catch (error: any) {
    console.error('AI Chat Error:', error);
    return NextResponse.json({ error: error.message || 'An error occurred' }, { status: 500 });
  }
}
