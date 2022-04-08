// Copyright 2015, Google Inc. All Rights Reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

/**
 * @name Account Summary Report
 *
 * @overview The Account Summary Report script generates an at-a-glance report
 *     showing the performance of an entire Google Ads account. See
 *     https://developers.google.com/google-ads/scripts/docs/solutions/account-summary
 *     for more details.
 *
 * @Based on Google Ads Scripts Team [adwords-scripts@googlegroups.com]
 * @Improved By [flopez.amm@aletheia-na.com]
 * @version 1.2
 * //For PPC Managers you can track your campaigns with this script code, the advantage of this is that you can filter
 * //your report by text in the name of the campaign example (2022_search_budget_etc) then you can filter the report
 * //using the function var by adding the text "budget" which is the unique text label you've been added to that specific
 * //campaign.
 *
 * @changelog
 * - version 1.1
 *   - Add user-updateable fields, and ensure report row ordering.
 * - version 1.0.4
 *   - Improved code readability and comments.
 * - version 1.0.3
 *   - Added validation for external spreadsheet setup.
 * - version 1.0.2
 *   - Fixes date formatting bug in certain timezones.
 * - version 1.0.1
 *   - Improvements to time zone handling.
 * - version 1.0
 *   - Released initial version.
 */
// Copy the next template: https://docs.google.com/spreadsheets/d/1BfTMagjSasF4ezENdQ90Je3wsBH9_ywp6OUiWRBfENc/edit#gid=3
//You will find the columns of the report made by the script, also you will find other fields like %forecast etc...,
//You only will have to enter the number of the days of the current month, the current days are just the count of the cells
//no need to touch that.
//The remaining days are just the remain of current days - total days.
//This is the link for the report https://datastudio.google.com/s/jz_n8KliaMg you can request access.

 var SPREADSHEET_URL = 'paste the URL Spreedsheet here';

 /**
  * Configuration to be used for running reports.
  */
 var REPORTING_OPTIONS = {
   // Comment out the following line to default to the latest reporting version.
   apiVersion: 'v201809'
 };
 
 /**
  * To add additional fields to the report, follow the instructions at the link
  * in the header above, and add fields to this variable, taken from the Account
  * Performance Report reference:
  * https://developers.google.com/adwords/api/docs/appendix/reports/account-performance-report
  */
 var REPORT_FIELDS = [
   {columnName: 'Cost', displayName: 'Cost'},
   {columnName: 'AverageCpc', displayName: 'Avg. CPC'},
   {columnName: 'Ctr', displayName: 'CTR'},
   {columnName: 'SearchImpressionShare', displayName: 'Search Impr. share'},
   {columnName: 'Impressions', displayName: 'Impressions'},
   {columnName: 'Clicks', displayName: 'Clicks'}
 ];
 
 var campaignNameDoesNotContain = [];
 // Use this if you want to exclude some campaigns.
 // For example ["Display"] would ignore any campaigns with 'Display' in the name,
 // while ["Display","Shopping"] would ignore any campaigns with 'Display' or
 // 'Shopping' in the name.
 // Leave as [] to not exclude any campaigns.
 
 
 var campaignNameContains = [];
 // Use this if you only want to look at some campaigns.
 // For example ["Brand"] would only look at campaigns with 'Brand' in the name,
 // while ["Brand","Generic"] would only look at campaigns with 'Brand' or 'Generic'
 // in the name.
 // Leave as [] to include all campaigns.
 
 function main() {
   Logger.log('Using spreadsheet - %s.', SPREADSHEET_URL);
   var spreadsheet = validateAndGetSpreadsheet();
   spreadsheet.setSpreadsheetTimeZone(AdsApp.currentAccount().getTimeZone());
   spreadsheet.getRangeByName('account_id_report').setValue(
       AdsApp.currentAccount().getCustomerId());
 
   var yesterday = getYesterday();
   var date = getFirstDayToCheck(spreadsheet, yesterday);
 
   var rows = [];
   var existingDates = getExistingDates();
 
   while (date.getTime() <= yesterday.getTime()) {
     if (!existingDates[date]) {
       var row = getReportRowForDate(date);
       rows.push([new Date(date)].concat(REPORT_FIELDS.map(function(field) {
         return row[field.columnName];
       })));
       spreadsheet.getRangeByName('last_check').setValue(date);
     }
     date.setDate(date.getDate() + 1);
   }
 
   if (rows.length > 0) {
     writeToSpreadsheet(rows);
 
     var email = spreadsheet.getRangeByName('email').getValue();
     if (email) {
       sendEmail(email);
     }
   }
 }
 
 /**
  * Retrieves a lookup of dates for which rows already exist in the spreadsheet.
  *
  * @return {!Object} A lookup of existing dates.
  */
 function getExistingDates() {
   var spreadsheet = validateAndGetSpreadsheet();
   var sheet = spreadsheet.getSheetByName('Report');
 
   var data = sheet.getDataRange().getValues();
   var existingDates = {};
   data.slice(5).forEach(function(row) {
     existingDates[row[1]] = true;
   });
   return existingDates;
 }
 
 /**
  * Sorts the data in the spreadsheet into ascending date order.
  */
 function sortReportRows() {
   var spreadsheet = validateAndGetSpreadsheet();
   var sheet = spreadsheet.getSheetByName('Report');
 
   var data = sheet.getDataRange().getValues();
   var reportRows = data.slice(5);
   if (reportRows.length) {
     reportRows.sort(function(rowA, rowB) {
       if (!rowA || !rowA.length) {
         return -1;
       } else if (!rowB || !rowB.length) {
         return 1;
       } else if (rowA[1] < rowB[1]) {
         return -1;
       } else if (rowA[1] > rowB[1]) {
         return 1;
       }
       return 0;
     });
     sheet.getRange(6, 1, reportRows.length, reportRows[0].length)
         .setValues(reportRows);
   }
 }
 
 /**
  * Append the data rows to the spreadsheet.
  *
  * @param {Array<Array<string>>} rows The data rows.
  */
 function writeToSpreadsheet(rows) {
   var access = new SpreadsheetAccess(SPREADSHEET_URL, 'Report');
   var emptyRow = access.findEmptyRow(6, 2);
   if (emptyRow < 0) {
     access.addRows(rows.length);
     emptyRow = access.findEmptyRow(6, 2);
   }
   access.writeRows(rows, emptyRow, 2);
   sortReportRows();
 }
 
 function sendEmail(email) {
   var day = getYesterday();
   var yesterdayRow = getReportRowForDate(day);
   day.setDate(day.getDate() - 1);
   var twoDaysAgoRow = getReportRowForDate(day);
   day.setDate(day.getDate() - 5);
   var weekAgoRow = getReportRowForDate(day);
 
   var html = [];
   html.push(
     '<html>',
       '<body>',
         '<table width=800 cellpadding=0 border=0 cellspacing=0>',
           '<tr>',
             '<td colspan=2 align=right>',
               "<div style='font: italic normal 10pt Times New Roman, serif; " +
                   "margin: 0; color: #666; padding-right: 5px;'>" +
                   'Powered by Google Ads Scripts</div>',
             '</td>',
           '</tr>',
           "<tr bgcolor='#3c78d8'>",
             '<td width=500>',
               "<div style='font: normal 18pt verdana, sans-serif; " +
               "padding: 3px 10px; color: white'>Account Summary report</div>",
             '</td>',
             '<td align=right>',
               "<div style='font: normal 18pt verdana, sans-serif; " +
               "padding: 3px 10px; color: white'>",
                AdsApp.currentAccount().getCustomerId(), '</h1>',
             '</td>',
             '</tr>',
           '</table>',
           '<table width=800 cellpadding=0 border=0 cellspacing=0>',
             "<tr bgcolor='#ddd'>",
               '<td></td>',
               "<td style='font: 12pt verdana, sans-serif; " +
                   'padding: 5px 0px 5px 5px; background-color: #ddd; ' +
                   "text-align: left'>Yesterday</td>",
               "<td style='font: 12pt verdana, sans-serif; " +
                   'padding: 5px 0px 5px 5px; background-color: #ddd; ' +
                   "text-align: left'>Two Days Ago</td>",
               "<td style='font: 12pt verdana, sans-serif; " +
                   'padding: 5px 0px 5x 5px; background-color: #ddd; ' +
                   "text-align: left'>A week ago</td>",
             '</tr>');
   REPORT_FIELDS.forEach(function(field) {
     html.push(emailRow(
         field.displayName, field.columnName, yesterdayRow, twoDaysAgoRow,
         weekAgoRow));
   });
   html.push('</table>', '</body>', '</html>');
   MailApp.sendEmail(email, 'Google Ads Account ' +
       AdsApp.currentAccount().getCustomerId() + ' Summary Report', '',
       {htmlBody: html.join('\n')});
 }
 
 function emailRow(title, column, yesterdayRow, twoDaysAgoRow, weekAgoRow) {
   var html = [];
   html.push('<tr>',
       "<td style='padding: 5px 10px'>" + title + '</td>',
       "<td style='padding: 0px 10px'>" + yesterdayRow[column] + '</td>',
       "<td style='padding: 0px 10px'>" + twoDaysAgoRow[column] +
           formatChangeString(yesterdayRow[column], twoDaysAgoRow[column]) +
           '</td>',
       "<td style='padding: 0px 10px'>" + weekAgoRow[column] +
           formatChangeString(yesterdayRow[column], weekAgoRow[column]) +
           '</td>',
       '</tr>');
   return html.join('\n');
 }
 
 
 function getReportRowForDate(date) {
   var timeZone = AdsApp.currentAccount().getTimeZone();
   var dateString = Utilities.formatDate(date, timeZone, 'yyyyMMdd');
   return getReportRowForDuring(dateString + ',' + dateString);
 }
 
 function getReportRowForDuring(during) {
   var report = AdsApp.report(
       'SELECT ' +
           REPORT_FIELDS
               .map(function(field) {
                 return field.columnName;
               })
               .join(',') +
           ' FROM ACCOUNT_PERFORMANCE_REPORT ' +
           'DURING ' + during,
       REPORTING_OPTIONS);
   return report.rows().next();
 }
 
 function formatChangeString(newValue,  oldValue) {
   var x = newValue.indexOf('%');
   if (x != -1) {
     newValue = newValue.substring(0, x);
     var y = oldValue.indexOf('%');
     oldValue = oldValue.substring(0, y);
   }
 
   var change = parseFloat(newValue - oldValue).toFixed(2);
   var changeString = change;
   if (x != -1) {
     changeString = change + '%';
   }
 
   if (change >= 0) {
     return "<span style='color: #38761d; font-size: 8pt'> (+" +
         changeString + ')</span>';
   } else {
     return "<span style='color: #cc0000; font-size: 8pt'> (" +
         changeString + ')</span>';
   }
 }
 
 function SpreadsheetAccess(spreadsheetUrl, sheetName) {
   this.spreadsheet = SpreadsheetApp.openByUrl(spreadsheetUrl);
   this.sheet = this.spreadsheet.getSheetByName(sheetName);
 
   // what column should we be looking at to check whether the row is empty?
   this.findEmptyRow = function(minRow, column) {
     var values = this.sheet.getRange(minRow, column,
         this.sheet.getMaxRows(), 1).getValues();
     for (var i = 0; i < values.length; i++) {
       if (!values[i][0]) {
         return i + minRow;
       }
     }
     return -1;
   };
   this.addRows = function(howMany) {
     this.sheet.insertRowsAfter(this.sheet.getMaxRows(), howMany);
   };
   this.writeRows = function(rows, startRow, startColumn) {
     this.sheet.getRange(startRow, startColumn, rows.length, rows[0].length).
         setValues(rows);
   };
 }
 
 /**
  * Gets a date object that is 00:00 yesterday.
  *
  * @return {!Date} A date object that is equivalent to 00:00 yesterday in the
  *     account's time zone.
  */
 function getYesterday() {
   var yesterday = new Date(new Date().getTime() - 24 * 3600 * 1000);
   return new Date(getDateStringInTimeZone('MMM dd, yyyy 00:00:00 Z',
       yesterday));
 }
 
 /**
  * Returned the last checked date + 1 day, or yesterday if there isn't
  * a specified last checked date.
  *
  * @param {Spreadsheet} spreadsheet The export spreadsheet.
  * @param {Date} yesterday The yesterday date.
  *
  * @return {!Date} The date corresponding to the first day to check.
  */
 function getFirstDayToCheck(spreadsheet, yesterday) {
   var last_check = spreadsheet.getRangeByName('last_check').getValue();
   var date;
   if (last_check.length == 0) {
     date = new Date(yesterday);
   } else {
     date = new Date(last_check);
     date.setDate(date.getDate() + 1);
   }
   return date;
 }
 
 /**
  * Produces a formatted string representing a given date in a given time zone.
  *
  * @param {string} format A format specifier for the string to be produced.
  * @param {date} date A date object. Defaults to the current date.
  * @param {string} timeZone A time zone. Defaults to the account's time zone.
  * @return {string} A formatted string of the given date in the given time zone.
  */
 function getDateStringInTimeZone(format, date, timeZone) {
   date = date || new Date();
   timeZone = timeZone || AdsApp.currentAccount().getTimeZone();
   return Utilities.formatDate(date, timeZone, format);
 }
 
 /**
  * Validates the provided spreadsheet URL to make sure that it's set up
  * properly. Throws a descriptive error message if validation fails.
  *
  * @return {Spreadsheet} The spreadsheet object itself, fetched from the URL.
  */
 function validateAndGetSpreadsheet() {
   if ('YOUR_SPREADSHEET_URL' == SPREADSHEET_URL) {
     throw new Error('Please specify a valid Spreadsheet URL. You can find' +
         ' a link to a template in the associated guide for this script.');
   }
   var spreadsheet = SpreadsheetApp.openByUrl(SPREADSHEET_URL);
   var email = spreadsheet.getRangeByName('email').getValue();
   if ('foo@example.com' == email) {
     throw new Error('Please either set a custom email address in the' +
         ' spreadsheet, or set the email field in the spreadsheet to blank' +
         ' to send no email.');
   }
   return spreadsheet;
 }