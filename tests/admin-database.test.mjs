import test from 'node:test';
import {PGlite} from '@electric-sql/pglite';
import {verifyAdminDatabase} from './admin-database-check.mjs';
test('separate admin roles, invitation/session safeguards, moderation and audit permissions',()=>verifyAdminDatabase(PGlite));
