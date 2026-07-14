import test from 'node:test';
import assert from 'node:assert/strict';
import { defineTestMetadata } from '../harness/test-metadata.mjs';
const TEST_METADATA = defineTestMetadata({ testClass: 'POLICY_PENDING', sourceFiles: ['sheetNhapXuat.js'], ownerPolicyRequired: true, runtimeMutation: 'NONE' });
function model(rows){let sl=0, gt=0, dgbq=0; return rows.map(r=>{ if(r.type==='NHAP'){sl+=r.qty; gt+=r.qty*r.price; dgbq=sl?gt/sl:0;} else {let q=r.qty; if(q>sl) q=sl; gt=(sl-q)*dgbq; sl-=q; if(sl<=0){sl=0;gt=0;dgbq=0;} } return {sl, dgbq};});}
test('BUG-BQGQ-ORDERING: current model depends on row order', () => {
  const a = model([{type:'NHAP',qty:10,price:1000},{type:'XUAT',qty:5},{type:'NHAP',qty:10,price:2000}]).at(-1);
  const b = model([{type:'NHAP',qty:10,price:2000},{type:'XUAT',qty:5},{type:'NHAP',qty:10,price:1000}]).at(-1);
  assert.notDeepEqual(a, b);
});
