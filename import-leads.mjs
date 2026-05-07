// import-leads.mjs
// Run this ONCE to import all your CSV leads into Supabase
// Usage: node import-leads.mjs
// Place your CSV files in the same folder as this script

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { parse } from 'csv-parse/sync'

const supabaseUrl = 'https://sdlosxhgqakrumhtzsns.supabase.co'
// Paste your publishable key below
const supabaseKey = 'sb_publishable_mUHljtonGQzWVNVaPPcjlQ_HX2pswQB'

const supabase = createClient(supabaseUrl, supabaseKey)

function parseCSV(filePath) {
  const content = readFileSync(filePath, 'utf-8')
  return parse(content, { columns: true, skip_empty_lines: true, trim: true })
}

function mapUCC(row) {
  const [first_name, last_name] = (row.name || '').split(' ')
  return {
    lead_type: 'ucc',
    name: row.name || null,
    first_name: row.first_name || first_name || null,
    last_name: row.last_name || last_name || null,
    company_name: row.company_name || null,
    phone: row.phone || null,
    state: row.state || null,
    number_type: row.number_type || null,
    title: row.title || null,
    email: row.email || null,
    address: row.address || null,
    city: row.city || null,
    zip: row.zip || null,
    sic_code: row.sic_code || null,
    sic_description: row.sic_description || null,
    employee_size: row.employee_size ? parseInt(row.employee_size) : null,
    revenue: row.revenue ? parseFloat(row.revenue) : null,
    filing_day: row.filing_day ? parseInt(row.filing_day) : null,
    filing_month: row.filing_month ? parseInt(row.filing_month) : null,
    filing_year: row.filing_year ? parseInt(row.filing_year) : null,
    sec_partyname: row.sec_partyname || null,
    lead_score: 75,
    status: 'New',
  }
}

function mapTrigger(row) {
  const [first_name, last_name] = (row.name || '').split(' ')
  return {
    lead_type: 'trigger',
    name: row.name || null,
    first_name: row.first_name || first_name || null,
    last_name: row.last_name || last_name || null,
    company_name: row.company_name || null,
    phone: row.phone || null,
    state: row.state || null,
    number_type: row.number_type || null,
    title: row.title || null,
    email: row.email || null,
    sic_code: row.sic_code || null,
    sic_description: row.sic_description || null,
    day: row.day ? parseInt(row.day) : null,
    month: row.month ? parseInt(row.month) : null,
    year: row.year ? parseInt(row.year) : null,
    lead_score: 60,
    status: 'New',
  }
}

function mapAged(row) {
  const [first_name, last_name] = (row.name || '').split(' ')
  return {
    lead_type: 'aged',
    name: row.name || null,
    first_name: row.first_name || first_name || null,
    last_name: row.last_name || last_name || null,
    company_name: row.company_name || null,
    phone: row.phone || null,
    email: row.email || null,
    line_type: row.line_type || null,
    lead_score: 25,
    status: 'New',
  }
}

function mapWeb(row) {
  const [first_name, last_name] = (row.name || '').split(' ')
  return {
    lead_type: 'web',
    name: row.name || null,
    first_name: row.first_name || first_name || null,
    last_name: row.last_name || last_name || null,
    company_name: row.company_name || null,
    phone: row.phone || null,
    email: row.email || null,
    requested_amount: row.requested_amount || null,
    why_funds: row.why_funds || null,
    tib: row.tib || null,
    monthly_deposit: row.monthly_deposit || null,
    best_time: row.best_time || null,
    fico: row.fico ? parseInt(row.fico) : null,
    lead_type_label: row.lead_type || null,
    date_sold: row.date_sold || null,
    lead_score: 85,
    status: 'New',
  }
}

async function importBatch(records, label) {
  console.log(`\nImporting ${records.length} ${label} leads...`)
  
  // Insert in batches of 100
  const batchSize = 100
  let imported = 0
  
  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, i + batchSize)
    const { error } = await supabase.from('leads').insert(batch)
    if (error) {
      console.error(`Error on batch ${i}:`, error.message)
    } else {
      imported += batch.length
      console.log(`  ✓ ${imported}/${records.length} imported`)
    }
  }
}

async function main() {
  console.log('APEX CRM — Lead Import Tool')
  console.log('============================')

  try {
    // UCC Leads
    const uccRows = parseCSV('ucc_leads_sync.csv')
    await importBatch(uccRows.map(mapUCC), 'UCC')

    // Trigger Leads
    const triggerRows = parseCSV('trigger_leads_sync.csv')
    await importBatch(triggerRows.map(mapTrigger), 'Trigger')

    // Aged Leads
    const agedRows = parseCSV('aged_leads_sync__1_.csv')
    await importBatch(agedRows.map(mapAged), 'Aged')

    // Web Leads
    const webRows = parseCSV('web_leads_sync.csv')
    await importBatch(webRows.map(mapWeb), 'Web')

    console.log('\n✅ All leads imported successfully!')
    console.log('Open your CRM and hit Refresh to see them.')

  } catch (err) {
    console.error('Import failed:', err.message)
  }
}

main()
