#!/usr/bin/env node
// Local simulated acceptance; never enables a provider or supplies credentials.
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';
const BASE=process.env.ATELIER_BASE??'http://127.0.0.1:3010';
const OUT=process.env.ATELIER_SCREENSHOT_DIR??'docs/review/premium-continuity';
fs.mkdirSync(OUT,{recursive:true});
const results=[];
function check(name,ok,evidence){results.push({name,ok,evidence});console.log(ok?'PASS':'FAIL',name,evidence??'');}
const browser=await puppeteer.launch({executablePath:process.env.ATELIER_BROWSER_PATH??'/usr/bin/chromium',headless:true,args:['--no-sandbox','--disable-gpu']});
const page=await browser.newPage();
await page.setBypassServiceWorker(true); await page.setCacheEnabled(false);
page.setDefaultTimeout(30000);
await page.setViewport({width:1440,height:1000});
async function goto(route){await page.goto(BASE+route,{waitUntil:'networkidle0'});}
async function clickText(label){await page.waitForFunction(label=>[...document.querySelectorAll('button,a')].some(n=>n.textContent?.trim()===label),{},label);await page.evaluate((label)=>{const button=[...document.querySelectorAll('button,a')].find(n=>n.textContent?.trim()===label);if(!button)throw new Error('Missing '+label);button.click()},label);}
async function signIn(){await goto('/account');await page.evaluate(async()=>{const r=await fetch('/api/session/sign-in',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email:'owner.local@atelier.invalid'})});if(!r.ok)throw new Error('local sign-in '+r.status)});}
async function signOut(){await page.evaluate(async()=>fetch('/api/session/sign-out',{method:'POST'}));}
async function shot(name){await page.screenshot({path:path.join(OUT,name+'.png'),fullPage:true});}
try {
await signIn();await goto('/companion/studio');
const fixture=await page.evaluate(async()=>{const workspace=await fetch('/api/companion/workspace').then(r=>r.json());const response=await fetch('/api/companion/studio',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({businessId:workspace.business.id,headline:'Meridian opening',body:'A considered space for everyday gathering.',direction:'Keep the approved identity and exact lettering.'})});return response.json()});
if(!fixture.draft)throw new Error(JSON.stringify(fixture));
const destination='/companion/studio?draftId='+encodeURIComponent(fixture.draft.id)+'&review=exact';
await signOut();await goto(destination);
await page.waitForSelector('a.btn-gold[href*="/account?next="]');
const next=await page.$eval('a.btn-gold[href*="/account?next="]',n=>new URL(n.href).searchParams.get('next'));
check('signed-out Studio retains full pathname and query',next===destination,next);
await page.click('a.btn-gold[href*="/account?next="]');await page.waitForFunction(()=>[...document.querySelectorAll('button')].some(n=>n.textContent?.includes('owner.local@atelier.invalid')));
await page.evaluate(()=>{[...document.querySelectorAll('button')].find(n=>n.textContent?.includes('owner.local@atelier.invalid'))?.click()});
await page.waitForFunction(expected=>location.pathname+location.search===expected,{},destination);
await page.waitForFunction(()=>document.querySelector('#headline')?.value==='Meridian opening');
check('sign-in returns to exact saved draft',new URL(page.url()).pathname+new URL(page.url()).search===destination,page.url());
check('image direction survives reopen',await page.$eval('#direction',n=>n.value==='Keep the approved identity and exact lettering.'));
await signOut();await goto('/account');await page.evaluate(()=>localStorage.setItem('atelier.guestDraft.v1',JSON.stringify({version:1,kind:'guest_draft',draftId:'premium-review-guest',title:'Separate commission',brief:{vision:{key:'vision',value:'A separate commission idea',provenance:'client_statement'}},messages:[],updatedAt:new Date().toISOString()})));
await goto('/account?next='+encodeURIComponent(destination));await page.waitForFunction(()=>[...document.querySelectorAll('button')].some(n=>n.textContent?.includes('owner.local@atelier.invalid')));
await page.evaluate(()=>{[...document.querySelectorAll('button')].find(n=>n.textContent?.includes('owner.local@atelier.invalid'))?.click()});
await page.waitForFunction(()=>location.pathname==='/account/adopt');
check('guest adoption carries exact destination',new URL(page.url()).searchParams.get('next')===destination,page.url());
await clickText('Adopt into this account');await page.waitForFunction(expected=>location.pathname+location.search===expected,{},destination);
check('explicit guest adoption returns to requested Studio',true,page.url());
await page.evaluate(()=>localStorage.removeItem('atelier.guestDraft.v1'));
await goto('/companion/work');await page.waitForSelector('input');
const search=await page.$('input[placeholder="Title or id"]');if(search){await search.type('no-result-premium-review-unique');await page.waitForFunction(()=>document.body.innerText.includes('No work matches these filters.'));check('search no-results is distinct from empty work',!await page.evaluate(()=>document.body.innerText.includes('No saved work yet')));await shot('work-search-no-results-1440');}
await page.setRequestInterception(true);let failToday=true;page.on('request',req=>{if(failToday&&req.url().includes('/api/companion/today'))req.respond({status:503,contentType:'application/json',body:JSON.stringify({error:'Review fixture: Today unavailable'})});else req.continue()});
await goto('/companion');await page.waitForFunction(()=>document.body.innerText.includes('Retry'));
check('Today failure exits perpetual gathering',!await page.evaluate(()=>document.body.innerText.includes('Gathering saved work')));await shot('today-retry-1440');
failToday=false;await clickText('Retry loading Today');await page.waitForFunction(()=>!document.body.innerText.includes('Review fixture: Today unavailable'));check('Today error can retry',true);
for(const width of [390,884,1440]){await page.setViewport({width,height:width===390?844:1000});await goto(destination);await page.waitForSelector('[data-studio-preview="canvas"]');const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1);check('Studio no horizontal overflow '+width,!overflow);await shot('studio-'+width);}
await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}]);await goto(destination);await page.keyboard.press('Tab');const focus=await page.evaluate(()=>({tag:document.activeElement?.tagName,outline:getComputedStyle(document.activeElement).outlineStyle,reduce:matchMedia('(prefers-reduced-motion: reduce)').matches}));check('keyboard focus and reduced-motion browser preference',focus.tag!=='BODY'&&focus.reduce,focus);await shot('studio-keyboard-reduced-motion-1440');
} catch(error){check('script completion',false,String(error));await shot('failure').catch(()=>{});}finally{await browser.close();fs.writeFileSync(path.join(OUT,'continuity-results.json'),JSON.stringify({mode:'isolated local simulated auth; live providers disabled',results},null,2));}
process.exitCode=results.some(r=>!r.ok)?1:0;
