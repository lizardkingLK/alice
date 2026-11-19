# Upload worklogs from Excel

Add several worklogs to one work item from an Excel workbook.

**Audience:** All project members

---

## Download the template

1. Open the work item.
2. Select the **Work Log** tab.
3. Select **Download template**.

Keep the `Worklogs` sheet name and these columns unchanged:

| Column          | Required | Notes                                 |
| --------------- | -------- | ------------------------------------- |
| Start Date/Time | Yes      | Excel date-time or a documented value |
| End Date/Time   | Yes      | Must be later than the start          |
| Description     | No       | Maximum 2,000 characters              |

Excel date-time cells and text without an offset are interpreted as UTC. For
overnight work, use the next calendar date in **End Date/Time**.

## Preview and import

1. Select **Excel upload**.
2. Drag an `.xlsx` file into the upload area, or select the area to browse.
3. Review every preview row, including the calculated hours.
4. Select **Import worklogs**.
5. Review the confirmation and select **Confirm import**.

The file can be at most 2 MB and contain at most 200 nonblank data rows. Alice
validates the whole workbook before import. If one row is invalid, no rows are
saved. Correct the listed Excel row numbers and upload the file again.

All imported rows belong to the open work item and to you. Upload is unavailable
when the item is Done or archived, or when you do not have project access.

## Log one entry manually

Use the **+** on the Work Log tab or beside **Time Tracking**. Choose a start and
end date-time; Alice calculates the duration automatically and supports entries
that end on the next day.

The worklog record stores the calculated hours, the start calendar date, and the
description. It does not store the selected start and end times. Existing rows
therefore cannot reliably refill those controls for editing.

## After import

Alice refreshes the Work Log table and the Time Tracking totals after a
successful import. New rows can also arrive through the work item's realtime
updates.

## Troubleshooting

- **Wrong file type or too large:** use an `.xlsx` file no larger than 2 MB.
- **Excel row errors:** correct every listed row before importing again.
- **Permission error:** confirm that you are a member of the work item's project.
- **Done item:** reopen the item before adding worklogs.

## Related

- [Comments and activity](./comments-and-activity.md)
- [Edit a work item](./edit-work-item.md)
