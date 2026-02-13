#!/usr/bin/env python3
"""
Script to fix emailService.ts companyId issues
"""
import re

# Read the file
with open('src/modules/email/services/emailService.ts', 'r') as f:
    content = f.read()

# Pattern replacements for adding companyId to Email objects
# These patterns add companyId: account.companyId to Email object literals

# Pattern 1: Email object with accountId: account.id (add companyId after it)
content = re.sub(
    r'(accountId: account\.id,)\n(\s+)(from:)',
    r'\1\n\2companyId: account.companyId,\n\2\3',
    content
)

# Pattern 2: For places where we create Email without account.companyId
content = re.sub(
    r'(const email: Email = \{[^}]+accountId: account\.id,)(\s+from:)',
    r'\1\n      companyId: account.companyId,\2',
    content
)

# Fix method calls - add account.companyId parameter

# getEmailsForUser - needs companyId as 2nd param
content = re.sub(
    r'this\.emailModel\.getEmailsForUser\(([^,]+),\s*\{',
    r'this.emailModel.getEmailsForUser(\1, account.companyId, {',
    content
)

# Write back
with open('src/modules/email/services/emailService.ts', 'w') as f:
    f.write(content)

print("Fixed email Service!")
