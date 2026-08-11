import test from 'node:test'
import assert from 'node:assert/strict'

import {
  validEmail,
  firstBulkEmail,
  validAlightURL,
  mailBaseline,
  latestFreshAlightURL
} from '../lib/utils.js'

test('validEmail menolak input kosong dan email rusak', () => {
  assert.equal(validEmail(''), false)
  assert.equal(validEmail('halo'), false)
  assert.equal(validEmail('.abc@example.com'), false)
  assert.equal(validEmail('abc..def@example.com'), false)
  assert.equal(validEmail('abc@example.com'), true)
})

test('firstBulkEmail membaca response nested', () => {
  const input = {
    status: true,
    data: {
      result: [
        { email: 'premium1@example.com' }
      ]
    }
  }

  assert.equal(firstBulkEmail(input), 'premium1@example.com')
})

test('firstBulkEmail melewati sender email Alight', () => {
  const input = {
    data: [
      'noreply@alight-creative.firebaseapp.com',
      'realuser@example.net'
    ]
  }

  assert.equal(firstBulkEmail(input), 'realuser@example.net')
})

test('validAlightURL hanya menerima link Alight/Firebase', () => {
  assert.equal(validAlightURL('https://example.com/login'), false)
  assert.equal(validAlightURL('https://alight-creative.firebaseapp.com/__/auth/action?x=1'), true)
})

test('latestFreshAlightURL mengabaikan baseline', () => {
  const oldMessage = {
    subject: 'old',
    login_url: 'https://alight-creative.firebaseapp.com/old'
  }

  const baseline = mailBaseline({ messages: [oldMessage] })

  const inbox = {
    messages: [
      {
        subject: 'new',
        created_at: new Date().toISOString(),
        login_url: 'https://alight-creative.firebaseapp.com/new'
      },
      oldMessage
    ]
  }

  assert.equal(
    latestFreshAlightURL(inbox, baseline, Date.now() - 1000),
    'https://alight-creative.firebaseapp.com/new'
  )
})
