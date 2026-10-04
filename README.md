# LiveLayer — live.asem.work

نسخة جاهزة للاستضافة الذاتية. العربية هي الصفحة الرئيسية `/`، والإنجليزية `/en/`.

## ما الذي ترفعه؟

ارفع محتويات هذا المجلد إلى `/var/www/live.asem.work` على خادم Ubuntu/Nginx. مجلد `public` هو **جذر الموقع الذي يراه الزوّار فقط**. بقية الملفات تبقى خارج جذر الويب. التصميم والصفحات مبنية مسبقاً؛ لا تحتاج `npm install` أو عملية بناء على الخادم.

**المتطلبات:** Nginx، وNode.js 24 LTS مثبت على مستوى النظام. Node مطلوب لاستقبال وحفظ طلبات الاجتماع. الواجهة ملفات ثابتة تُقدَّم مباشرةً من Nginx.

## 1. DNS والمتطلبات

- أضف سجل A للنطاق `live.asem.work` إلى IPv4 الخاص بالخادم.
- أضف AAAA فقط إذا كان IPv6 يعمل فعلاً على الخادم.
- افتح المنفذين 80 و443؛ لا تفتح المنفذ 3080 للعامة.
- ثبّت إصدار Node.js 24 LTS المدعوم من https://nodejs.org/en/download مع التحقق من SHA256 المنشور. استخدم تثبيتاً على مستوى النظام؛ لا تستخدم Node داخل مجلد `/root/.nvm` للخدمة.

```bash
node --version
sudo apt update
sudo apt install nginx unzip certbot python3-certbot-nginx
sudo mkdir -p /var/www/live.asem.work
sudo unzip live-asem-work.zip -d /var/www/live.asem.work
cd /var/www/live.asem.work
```

The ZIP contains files directly at its root. If you upload with SFTP, upload its contents into `/var/www/live.asem.work`.

## 2. تشغيل الخدمة وNginx

```bash
cd /var/www/live.asem.work
sudo bash deploy/install.sh
sudo certbot --nginx -d live.asem.work --redirect
sudo systemctl status livelayer --no-pager
sudo nginx -t
```

سكربت التثبيت ينشئ مستخدماً محدود الصلاحيات وخدمة Systemd، ويخصص ملف Nginx لهذا النطاق. إذا وجد إعداداً سابقاً لنفس النطاق أو الخدمة، يتوقف حتى تراجعه يدوياً. لا يعدّل إعدادات مواقعك الأخرى. افحص الملفات في `deploy/` إذا كان لديك إعداد Nginx مخصص أو الخدمة تستخدم المنفذ 3080 مسبقاً.

Complete HTTPS before testing the form. The API accepts requests only from `https://live.asem.work`; HTTP, a different domain or opening the page as a local file will not submit.

## 3. التحقق بعد الرفع

افتح `https://live.asem.work` و`https://live.asem.work/en/`. جرّب اللغة، الشريط المتحرك، هويات التطبيق، أمثلة التفاعل، ثم أرسل طلب اجتماع تجريبياً بتاريخ مستقبلي. تحقق من ظهوره في تصدير الطلبات أدناه.

```bash
curl -I https://live.asem.work/
curl -I https://live.asem.work/en/
curl -I -H 'Accept-Encoding: gzip' https://live.asem.work/
curl -I https://live.asem.work/not-a-page
sudo journalctl -u livelayer -n 50 --no-pager
```

Expected: the first two return 200, the compressed response includes `Content-Encoding: gzip`, and the unknown page returns 404. Never publish the deployment folder itself as the web root; only `public/`.

## طلبات الاجتماعات

- تُحفظ في `/var/lib/livelayer/meetings.sqlite` خارج جذر الويب.
- لا يتم إرسال بريد أو إنشاء موعد تقويم تلقائياً. هذه **طلبات تحتاج تأكيداً يدوياً**، وهذا موضّح للزائر.
- الطلب يتضمن الأفكار المختارة من العرض، والموعد بتوقيت الرياض.
- لا يحتوي هذا الملف على بيانات الطلبات القديمة من استضافة Sites. تبدأ قاعدة بيانات الخادم الجديد فارغة.
- لا توجد لوحة إدارة عامة؛ استخرج CSV عبر SSH. تعامل معه كبيانات خاصة.

```bash
cd /var/www/live.asem.work
sudo -u livelayer env DATA_FILE=/var/lib/livelayer/meetings.sqlite \
  node server/export-meetings.mjs > meetings.csv
```

احفظ التصدير خارج `public/`. استخدم البيانات لمتابعة الطلب فقط، واحذفها عندما تنتفي الحاجة إليها وفق سياسة شركتك.

### النسخ الاحتياطي

استخدم نسخة SQLite متسقة، وليس نسخ ملف قاعدة البيانات وحده أثناء عمل WAL:

```bash
sudo apt install sqlite3
sudo install -d -m 700 /var/backups/livelayer
sudo sqlite3 /var/lib/livelayer/meetings.sqlite \
  ".backup '/var/backups/livelayer/meetings-backup.sqlite'"
sudo chmod 600 /var/backups/livelayer/meetings-backup.sqlite
```

Keep encrypted backups off the server as well. On updates, preserve `/var/lib/livelayer`; it is independent of the website package.

## الأداء

- HTML جاهز لكل لغة، مع إبقاء التفاعل عبر React.
- إزالة حزم إطار العمل والخدمات غير المستخدمة من التصدير.
- ملفات JS/CSS مصغّرة، وضغط Gzip/Brotli مُسبق.
- Nginx يقدّم Gzip الثابت؛ ملفات Brotli متاحة للخوادم التي تدعمها. لا يعتمد الإعداد على إضافة Brotli اختيارية.
- صور WebP متجاوبة بثلاثة أحجام لكل صورة، تحميل مؤجل للصورة الثانوية وأبعاد ثابتة.
- خطوط WOFF2 محلية مقتصرة على الحروف المستخدمة، دون طلب Google Fonts وقت التصفح.
- تخزين مؤقت طويل لملفات JS/CSS ذات البصمة، وسبعة أيام للصور والخطوط، وإعادة تحقق لصفحات HTML.
- احترام تفضيل تقليل الحركة، مع زر إيقاف الحركات.

Actual speed depends on your server, network and device. No Lighthouse or Core Web Vitals score is claimed. Browser visual testing was unavailable during export; perform the short live checklist above after deployment.

## SEO وظهور المحتوى في أنظمة الذكاء الاصطناعي

- عنوان ووصف وcanonical منفصلان لكل لغة.
- hreflang متبادل `ar` و`en` و`x-default`.
- محتوى HTML قابل للقراءة دون انتظار JavaScript، وروابط لغة فعلية.
- Open Graph وTwitter cards وصورة مشاركة 1200×630.
- JSON-LD يصف المنظمة والموقع والصفحات والتصوّر وقائمة الأفكار؛ لا توجد أسعار أو تقييمات أو تجارب عملاء مختلقة.
- `robots.txt` و`sitemap.xml` على النطاق الصحيح، و404 حقيقية.
- `llms.txt` ملخص إضافي للفكرة وحدودها. ليس معياراً مضموناً للترتيب ولا بديلاً عن المحتوى العام القابل للفهرسة.

بعد تشغيل HTTPS، أضف النطاق إلى Google Search Console وBing Webmaster Tools، ثم قدّم `https://live.asem.work/sitemap.xml`. راجع إعدادات ظهور المحتوى في ميزات البحث التوليدية داخل Search Console. الفهرسة والترتيب والظهور في إجابات الذكاء الاصطناعي ليست مضمونة.

Official references used:
- https://developers.google.com/search/docs/fundamentals/ai-optimization-guide
- https://developers.google.com/search/docs/specialty/international/localized-versions
- https://nginx.org/en/docs/http/ngx_http_gzip_module.html
- https://nodejs.org/api/sqlite.html

## تعديل المصدر وإعادة البناء (اختياري)

لا تستخدم ملفات استضافة Sites أو Cloudflare؛ التصدير مستقل عنها.

```bash
npm install
npm run build
npm test
```

- `src/App.tsx`: المحتوى والتفاعل واللغة.
- `src/styles.css`: تنسيق الموقع مع CSS reset محلي.
- `src/fonts.css`: الخطوط المحلية؛ إذا أضفت حروفاً جديدة غير موجودة، أعد إنتاج الخطوط أو استخدم النسخة الكاملة المرخّصة.
- `src/images/`: الصور المصدر.
- `scripts/build.mjs`: التصغير، الصور، HTML، metadata، sitemap، llms.txt والضغط.
- `server/`: خدمة API مستقلة بلا حزم npm وقت التشغيل، وتصدير CSV.
- `deploy/`: إعدادات Nginx وSystemd وسكربت التثبيت.
- `licenses/`: تراخيص الخطوط والمكتبات الموزعة.

After rebuilding, upload the new `public/` files and changed server code. Keep old hashed JS/CSS assets briefly during rollout so open tabs can finish using them. Restart the API only when server code changes: `sudo systemctl restart livelayer`.
