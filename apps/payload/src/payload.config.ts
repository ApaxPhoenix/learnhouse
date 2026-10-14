import { postgresAdapter } from '@payloadcms/db-postgres'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import path from 'path'
import { buildConfig } from 'payload'
import { fileURLToPath } from 'url'
import sharp from 'sharp'

import { Users } from './collections/Users'
import { Questions } from './collections/Questions'
import { Media } from './collections/Media'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

export default buildConfig({
  cors: ["*"],
  admin: {
    user: Users.slug,
    importMap: {
      baseDir: path.resolve(dirname),
    },
  },
  collections: [Users, Questions, Media],
  editor: lexicalEditor(),
  secret: process.env.PAYLOAD_SECRET || '',
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
  db: postgresAdapter({
    pool: {
      connectionString: process.env.DATABASE_URL || '',
    },
    // NEVER auto-push in dev: the SAT practice tables (user_attempts,
    // user_test_sessions — apps/web/.../practice/schema.sql) live in this same
    // database but aren't Payload collections, so drizzle's dev push tries to
    // DROP them (tablesFilter doesn't cover their sequences). Change the
    // schema with `pnpm --filter @learnhouse/payload payload migrate:create`
    // and `... payload migrate` instead.
    push: false,
  }),
  sharp,
  plugins: [],
})