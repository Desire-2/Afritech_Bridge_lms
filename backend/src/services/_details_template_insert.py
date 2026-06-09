"""Insert the _get_admin_interview_details_updated_template method into internship_mailer.py"""
with open('src/services/internship_mailer.py', 'r') as f:
    content = f.read()

# Only proceed if the def doesn't exist yet
if 'def _get_admin_interview_details_updated_template' in content:
    print('Method definition already exists - skipping')
else:
    template_method = '''
    def _get_admin_interview_details_updated_template(self):
        return '''
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%);
            padding: 20px;
        }
        .container {
            max-width: 600px;
            margin: 0 auto;
            background: #ffffff;
            border-radius: 16px;
            overflow: hidden;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
        }
        .header {
            background: linear-gradient(135deg, #1e3a8a 0%, #0891b2 100%);
            padding: 36px 30px;
            text-align: center;
            position: relative;
            overflow: hidden;
        }
        .header::before {
            content: '';
            position: absolute;
            top: -50%%; left: -50%%;
            width: 200%%; height: 200%%;
            background: radial-gradient(circle at 30%% 50%%, rgba(8,145,178,0.2) 0%%, transparent 50%%);
        }
        .header-content { position: relative; z-index: 1; }
        .header .icon { font-size: 44px; margin-bottom: 10px; display: block; }
        .header h1 {
            color: #ffffff;
            font-size: 24px;
            font-weight: 800;
            margin-bottom: 6px;
        }
        .header p { color: rgba(255,255,255,0.85); font-size: 14px; }
        .body-content { padding: 32px; color: #334155; }
        .body-content h2 { color: #0f172a; font-size: 18px; margin-bottom: 16px; }
        .body-content p { line-height: 1.7; margin-bottom: 16px; }
        .updated-by-banner {
            background: linear-gradient(135deg, #ecfeff 0%%, #cffafe 100%%);
            border: 2px solid #0891b2;
            border-radius: 12px;
            padding: 18px 24px;
            margin: 16px 0;
            display: flex;
            align-items: center;
            gap: 14px;
        }
        .updated-by-banner .avatar {
            width: 44px; height: 44px;
            background: linear-gradient(135deg, #0891b2, #0e7490);
            border-radius: 50%%;
            display: flex; align-items: center; justify-content: center;
            font-size: 20px; flex-shrink: 0;
        }
        .updated-by-banner .info { flex: 1; }
        .updated-by-banner .info .who {
            font-weight: 700; color: #164e63; font-size: 15px;
        }
        .updated-by-banner .info .when {
            color: #0891b2; font-size: 13px; margin-top: 2px;
        }
        .applicant-card {
            background: #f8fafc; border: 1px solid #e2e8f0;
            border-radius: 12px; padding: 20px; margin: 16px 0;
        }
        .info-row {
            display: flex; align-items: center;
            padding: 10px 14px; background: white;
            border-radius: 8px; margin-bottom: 6px;
        }
        .info-row .ilabel {
            font-weight: 600; color: #64748b;
            width: 100px; font-size: 13px;
        }
        .info-row .ivalue {
            color: #0f172a; font-weight: 500;
            font-size: 14px; flex: 1;
        }
        .details-card {
            background: #f0fdfa; border: 2px solid #14b8a6;
            border-radius: 12px; padding: 20px; margin: 16px 0;
        }
        .details-card .details-header {
            display: flex; align-items: center; gap: 8px; margin-bottom: 12px;
        }
        .details-card .details-header h3 {
            color: #065f46; font-size: 15px; font-weight: 700;
        }
        .details-card .details-header .badge-updated {
            background: #14b8a6; color: white; font-size: 10px; font-weight: 700;
            padding: 2px 8px; border-radius: 10px; text-transform: uppercase; letter-spacing: 0.5px;
        }
        .detail-row {
            display: flex; align-items: center; gap: 10px;
            padding: 10px 14px; background: rgba(255,255,255,0.8);
            border-radius: 8px; margin-bottom: 6px;
        }
        .detail-row:last-child { margin-bottom: 0; }
        .detail-row .dicon { font-size: 16px; width: 24px; text-align: center; }
        .detail-row .dlabel { font-weight: 600; color: #065f46; width: 110px; font-size: 13px; }
        .detail-row .dvalue { color: #0f172a; font-weight: 500; font-size: 14px; flex: 1; }
        .detail-row .dvalue .link {
            color: #0891b2; font-weight: 600; word-break: break-all;
        }
        .detail-row .dvalue .na { color: #94a3b8; font-style: italic; }
        .cta-button {
            display: block; text-align: center;
            padding: 14px 24px;
            background: linear-gradient(135deg, #0891b2 0%%, #0e7490 100%%);
            color: #ffffff !important; text-decoration: none;
            border-radius: 10px; font-size: 15px; font-weight: 700;
            margin: 20px 0;
            box-shadow: 0 4px 15px rgba(8,145,178,0.3);
        }
        .footer {
            background: #0f172a; padding: 24px 32px; text-align: center;
        }
        .footer p { color: #94a3b8; font-size: 12px; line-height: 1.6; }
        .footer .brand { color: #14b8a6; font-weight: 700; font-size: 14px; margin-bottom: 6px; }
        @media (max-width: 480px) {
            .header { padding: 28px 20px; }
            .body-content { padding: 24px; }
            .info-row { flex-direction: column; align-items: flex-start; gap: 4px; }
            .info-row .ilabel { width: auto; }
            .updated-by-banner { flex-direction: column; text-align: center; }
            .detail-row { flex-direction: column; align-items: flex-start; gap: 4px; }
            .detail-row .dlabel { width: auto; }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="header-content">
                <span class="icon">&#128197;</span>
                <h1>Interview Details Updated</h1>
                <p>{{ full_name }} &mdash; {{ track_name }}</p>
            </div>
        </div>
        <div class="body-content">
            <p>Interview details have been updated for an internship applicant. Review the latest information below.</p>

            <div class="updated-by-banner">
                <div class="avatar">&#9998;&#65039;</div>
                <div class="info">
                    <div class="who">Updated by {{ updated_by_name }}</div>
                    <div class="when">{{ updated_at }}</div>
                </div>
            </div>

            <div class="applicant-card">
                <div class="info-row">
                    <span class="ilabel">&#128100; Name</span>
                    <span class="ivalue"><strong>{{ full_name }}</strong></span>
                </div>
                <div class="info-row">
                    <span class="ilabel">&#128231; Email</span>
                    <span class="ivalue">{{ email }}</span>
                </div>
                <div class="info-row">
                    <span class="ilabel">&#128222; Phone</span>
                    <span class="ivalue">{{ phone }}</span>
                </div>
                <div class="info-row">
                    <span class="ilabel">&#127919; Track</span>
                    <span class="ivalue">{{ track_name }}</span>
                </div>
                <div class="info-row">
                    <span class="ilabel">&#128203; Type</span>
                    <span class="ivalue">{{ applicant_type }}</span>
                </div>
                <div class="info-row">
                    <span class="ilabel">&#127987; Ref Code</span>
                    <span class="ivalue" style="font-family: monospace; font-weight: 700; color: #0891b2;">{{ reference_code }}</span>
                </div>
            </div>

            <div class="details-card">
                <div class="details-header">
                    <h3>&#128203; Interview Details</h3>
                    <span class="badge-updated">Updated</span>
                </div>
                <div class="detail-row">
                    <span class="dicon">&#128197;</span>
                    <span class="dlabel">Date &amp; Time</span>
                    <span class="dvalue">{{ interview_date }}</span>
                </div>
                <div class="detail-row">
                    <span class="dicon">&#128187;</span>
                    <span class="dlabel">Platform</span>
                    <span class="dvalue">{{ meeting_platform }}</span>
                </div>
                <div class="detail-row">
                    <span class="dicon">&#128279;</span>
                    <span class="dlabel">Meeting Link</span>
                    <span class="dvalue">
                        {% if meeting_link and meeting_link != 'Not provided' %}
                        <a href="{{ meeting_link }}" class="link" target="_blank">{{ meeting_link }}</a>
                        {% else %}
                        <span class="na">Not provided</span>
                        {% endif %}
                    </span>
                </div>
            </div>

            <a href="{{ admin_link }}" class="cta-button">&#128269; View Full Application</a>

            <p style="text-align: center; color: #94a3b8; font-size: 13px;">
                Open in admin panel to see the complete application and interview history.
            </p>
        </div>
        <div class="footer">
            <p class="brand">&#10026; AFRITECH BRIDGE &#10026;</p>
            <p>Empowering the next generation of African tech leaders</p>
        </div>
    </div>
</body>
</html>
'''

    # Find insertion point - after _get_admin_interview_notes_updated_template's return '''
    # and before the _get_shortlisted_template
    marker = "    def _get_admin_interview_notes_updated_template(self):"
    insert_pos = content.find(marker)
    if insert_pos == -1:
        print('ERROR: Could not find insertion point')
    else:
        # Find the end of this method - search for the next "def" after the marker
        next_def_pos = content.find('\n    def _', insert_pos + len(marker))
        if next_def_pos == -1:
            print('ERROR: Could not find next method boundary')
        else:
            content = content[:next_def_pos] + '\n' + template_method + content[next_def_pos:]
            with open('src/services/internship_mailer.py', 'w') as f:
                f.write(content)
            print('Template method inserted successfully')

import os
os.remove('src/services/_details_template_insert.py')
