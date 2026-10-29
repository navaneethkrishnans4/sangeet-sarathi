import openpyxl
from pathlib import Path
import gspread

def aggregate_fees_gspread(gc, sheet_id, category, totals):
    try:
        sh = gc.open_by_key(sheet_id)
        ws = sh.worksheet("Enrolment Sheet")
    except Exception as e:
        print(f"Error opening sheet {sheet_id} or worksheet: {e}")
        return
        
    # Get all values
    all_rows = ws.get_all_values()
    
    # Iterate from row 7 onwards (index 6)
    for r in range(6, len(all_rows)):
        row = all_rows[r]
        # Pad row to 38 columns to avoid IndexError
        row += [""] * (40 - len(row))
        
        # openpyxl columns are 1-based. 
        # col 2 (B) -> index 1
        first_name = row[1].strip()
        if not first_name:
            continue
            
        school = row[27].strip() # col 28
        submitter_first = row[18].strip() # col 19
        submitter_last = row[19].strip() # col 20
        applicant = row[25].strip() # col 26
        submitter = f"{submitter_first} {submitter_last}".strip()
        
        # Determine emails
        cand_email = row[5].strip() # col 6
        sub_email = row[20].strip() # col 21
        
        fee_val = row[37].strip() # col 38
        try:
            fee = float(fee_val.replace(',', '')) if fee_val else 0.0
        except ValueError:
            fee = 0.0
            
        # Improved grouping: Group by submitter email first, so there's only one entry per email ID.
        # If no email, fallback to candidate email, then school, then name.
        # EXCEPTION: Ignore the generic ops email so independent teachers aren't lumped together.
        generic_emails = ["trinitykochi.ops.office@gmail.com"]
        
        if sub_email and sub_email.lower() != "none" and sub_email.lower() not in generic_emails:
            canon_id = f"EMAIL:{sub_email.lower()}"
        elif cand_email and cand_email.lower() != "none" and cand_email.lower() not in generic_emails:
            canon_id = f"EMAIL:{cand_email.lower()}"
        elif school and school.lower() != "none":
            canon_id = f"SCHOOL:{school.lower()}"
        else:
            name = applicant if (applicant and applicant.lower() != "none") else submitter
            if not name or name.lower() == "none":
                name = "Unknown"
            canon_id = f"NAME:{name.lower()}"
            
        display_name = applicant
        if not display_name or display_name.lower() == "none":
            display_name = submitter
        if not display_name or display_name.lower() == "none":
            display_name = school
        if not display_name or display_name.lower() == "none":
            display_name = "Unknown"

        if canon_id not in totals:
            totals[canon_id] = {
                "Display Name": display_name,
                "Classical & Jazz": 0.0, 
                "Rock & Pop": 0.0, 
                "Combined": 0.0,
                "Academies": set(),
                "Emails": set()
            }
        else:
            # Keep the longer name (e.g. "Alphons Joseph" instead of "Alphons")
            if len(display_name) > len(totals[canon_id]["Display Name"]) and display_name != "Unknown":
                totals[canon_id]["Display Name"] = display_name
            
        totals[canon_id][category] += fee
        totals[canon_id]["Combined"] += fee
        
        if school and school.lower() != "none":
            totals[canon_id]["Academies"].add(school)
            
        if cand_email and cand_email.lower() != "none":
            totals[canon_id]["Emails"].add(cand_email)
        if sub_email and sub_email.lower() != "none":
            totals[canon_id]["Emails"].add(sub_email)


def create_dashboard(music_sheet_id, rp_sheet_id):
    base_dir = Path("/Users/navneethkrishnans/Documents/Trinity/Entries")
    
    # Find credentials
    app_dir = base_dir / "App and Scripts"
    creds_path = app_dir / "credentials.json"
    if not creds_path.exists():
        creds_path = app_dir / "trinity-503109-765805d01c09.json"
        
    gc = gspread.service_account(filename=str(creds_path))
    
    totals = {}
    
    aggregate_fees_gspread(gc, music_sheet_id, "Classical & Jazz", totals)
    aggregate_fees_gspread(gc, rp_sheet_id, "Rock & Pop", totals)
    
    # Sort by total combined fee descending
    sorted_entities = sorted(totals.items(), key=lambda x: x[1]["Combined"], reverse=True)
    
    out_wb = openpyxl.Workbook()
    ws = out_wb.active
    ws.title = "Fee Dashboard"
    
    headers = [
        "Person's Name (Teacher/Submitter)", 
        "Email IDs", 
        "Academy Names", 
        "Classical & Jazz Total (INR)", 
        "Rock & Pop Total (INR)", 
        "Combined Total (INR)"
    ]
    ws.append(headers)
    
    # Add styling to headers
    from openpyxl.styles import Font, Alignment
    for col in range(1, 7):
        ws.cell(row=1, column=col).font = Font(bold=True)
        # Adjust column widths
        if col == 1: ws.column_dimensions[openpyxl.utils.get_column_letter(col)].width = 25
        elif col == 2: ws.column_dimensions[openpyxl.utils.get_column_letter(col)].width = 35
        elif col == 3: ws.column_dimensions[openpyxl.utils.get_column_letter(col)].width = 45
        else: ws.column_dimensions[openpyxl.utils.get_column_letter(col)].width = 20
        
    for canon_id, data in sorted_entities:
        emails_str = ", ".join(sorted(data["Emails"]))
        academies_str = ", ".join(sorted(data["Academies"]))
        
        ws.append([
            data["Display Name"],
            emails_str,
            academies_str,
            data["Classical & Jazz"],
            data["Rock & Pop"],
            data["Combined"]
        ])
        
        # Set text wrapping for emails and academies
        ws.cell(row=ws.max_row, column=2).alignment = Alignment(wrap_text=True)
        ws.cell(row=ws.max_row, column=3).alignment = Alignment(wrap_text=True)
        
    # Append total row at bottom
    ws.append([])
    total_cj = sum(d["Classical & Jazz"] for d in totals.values())
    total_rp = sum(d["Rock & Pop"] for d in totals.values())
    total_combined = sum(d["Combined"] for d in totals.values())
    
    ws.append(["GRAND TOTAL", "", "", total_cj, total_rp, total_combined])
    ws.cell(row=ws.max_row, column=1).font = Font(bold=True)
    ws.cell(row=ws.max_row, column=4).font = Font(bold=True)
    ws.cell(row=ws.max_row, column=5).font = Font(bold=True)
    ws.cell(row=ws.max_row, column=6).font = Font(bold=True)
    
    dashboard_path = base_dir / "Fee_Dashboard.xlsx"
    out_wb.save(dashboard_path)
    print(f"Dashboard successfully generated at {dashboard_path}")

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument('--music-sheet', default='1o-c-nrvq-LoQYyvAmGBgxsNQ6X9hll52LC-APwYxcqE')
    parser.add_argument('--rp-sheet', default='1ee7cgY_YJjgTpMPtH7pQtVVDN1JWAjGlcONtqwae1VA')
    args = parser.parse_args()
    create_dashboard(args.music_sheet, args.rp_sheet)
