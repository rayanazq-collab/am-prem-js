import JSZip from 'jszip'

export async function bulkZip(text) {
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\..+$/, '').replace('T', '-')
  const txtName = `amprem-bulk-${stamp}.txt`
  const zipName = `amprem-bulk-${stamp}.zip`

  const zip = new JSZip()
  zip.file(txtName, `${String(text).trim()}\n`)
  const data = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' })
  return { data, zipName, txtName }
}
