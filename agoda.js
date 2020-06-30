const puppeteer = require('puppeteer');
const moment = require('moment');

const BASE_URL = "https://www.agoda.com/"

const agoda = {
  browser: null,
  page: null,

  initialize: async () => {
    agoda.browser = await puppeteer.launch({ headless: true });
    agoda.page = await agoda.browser.newPage();
  },
  search: async (destination, checkInDay, checkInMonth, checkInYear, checkOutDay, checkOutMonth, checkOutYear) => {
    await agoda.page.goto(BASE_URL, { waitUntil: 'networkidle0' });

    // Inputs destination
    await agoda.page.type('input[data-selenium="textInput"]', destination);
    await agoda.page.waitFor('li[data-selenium=autosuggest-item]');
    let possibleDestinations = await agoda.page.$$('li[data-selenium=autosuggest-item]');
    await possibleDestinations[0].click();

    let currentTime = moment();
    let checkInDate = moment([checkInDay, checkInMonth, checkInYear].join('-'), 'DD-MM-YYYY');
    let checkOutDate = moment([checkOutDay, checkOutMonth, checkOutYear].join('-'), 'DD-MM-YYYY');
    await agoda.selectCheckInDate(currentTime, checkInDate);
    await agoda.selectcheckOutDate(currentTime, checkInDate, checkOutDate);

    // Search
    await agoda.page.click('button[data-selenium=searchButton]');

    return await agoda.scrapeHotelDetails();
  },
  scrapeHotelDetails: async () => {
    await agoda.page.waitFor('li[data-selenium=hotel-item');

    let hotelDetails = [];
    var currentPage;
    var totalPage;
    var hotelName;
    var hotelPrice;
    var currency;

    do {
      var hotelCount = 0;

      // force lazy loading
      while (await agoda.page.evaluate(() => document.scrollingElement.scrollTop + window.innerHeight < document.scrollingElement.scrollHeight)) {
  
        // Scrape whatever is loaded
        // Required to do this because some data are lazy-loaded. We need to scrape as we go.
        let hotelContainer = await agoda.page.$$('li[data-selenium=hotel-item');
  
        for (let i = hotelCount; i < hotelContainer.length; i++) {
          let hotelDetail = await hotelContainer[i].$('.property-card-content');
          if (hotelDetail == null) {
            continue;
          }
          if (await hotelDetail.$('div[class=sold-out-message]') || !await hotelDetail.$('[data-selenium=hotel-name]') 
            || !await hotelDetail.$('[data-selenium=display-price]') || !await hotelDetail.$('[data-selenium=hotel-currency]')) {
            continue
          }
          hotelName = await hotelDetail.$eval('[data-selenium=hotel-name]', el => el.textContent);
          hotelPrice = await hotelDetail.$eval('[data-selenium=display-price]', el => el.textContent);
          currency = await hotelDetail.$eval('[data-selenium=hotel-currency]', el => el.textContent);
          hotelDetails.push({ hotelName: hotelName, hotelPrice: parseInt(hotelPrice), currency: currency });
          hotelCount++;
        }
        await agoda.page.evaluate(() => { window.scrollBy(0, window.innerHeight); });
        await agoda.page.waitFor(10);
      }

      // Checks whether have we finish scraping all the pages
      await agoda.page.waitFor('span[data-selenium=pagination-text]');
      let paginationText = await agoda.page.$eval('[data-selenium=pagination-text]', el => el.textContent);
      let paginationTextSplit = paginationText.split(" ");
      currentPage = parseInt(paginationTextSplit[1]);
      totalPage = parseInt(paginationTextSplit[3]);

      if (currentPage < totalPage) {
        await agoda.page.waitFor('button[data-selenium=pagination-next-btn]');
        await agoda.page.click('button[data-selenium=pagination-next-btn]');
      }
    } while (currentPage < totalPage);

    return hotelDetails;
  },
  areDatesValid: (checkInDay, checkInMonth, checkInYear, checkOutDay, checkOutMonth, checkOutYear) => {
    let currentTime = moment();
    let checkInDate = moment([checkInDay, checkInMonth, checkInYear].join('-'), 'DD-MM-YYYY');
    let checkOutDate = moment([checkOutDay, checkOutMonth, checkOutYear].join('-'), 'DD-MM-YYYY');
    return ((checkInDate.isValid() && checkOutDate.isValid()) && (checkOutDate.diff(checkInDate, 'days') > 0) 
      && (checkInDate.diff(currentTime, 'days') >= 0) && (checkOutDate.diff(currentTime, 'days') > 0))
  },
  selectCheckInDate: async(currentTime, checkInDate) => {
    let startOfCurrentMonth = currentTime.clone().startOf('month');
    let startOfMonthCheckInDate = checkInDate.clone().startOf('month');
    let checkInCurrentMonthDiff = startOfMonthCheckInDate.diff(startOfCurrentMonth, 'month');
    for (let i = 0; i < checkInCurrentMonthDiff - 1; i++) {
      await agoda.page.click('span[data-selenium=calendar-next-month-button]')
    }
    await agoda.page.waitFor('div[data-selenium=rangePickerCheckIn]');
    let checkInDatePickerWrapper = await agoda.page.$('div[data-selenium=rangePickerCheckIn] > div:first-child > div[class=DayPicker] > div:first-child');
    let checkInDatePicker = (checkInCurrentMonthDiff == 0) ?  await checkInDatePickerWrapper.$$('div[class=DayPicker-Months] > div:nth-child(1) > div[class=DayPicker-Body] div:not(.DayPicker-Day--disabled):not(.DayPicker-Week):not(.DayPicker-Day--outside)') 
      :  await checkInDatePickerWrapper.$$('div[class=DayPicker-Months] > div:nth-child(2) > div[class=DayPicker-Body] div:not(.DayPicker-Day--disabled):not(.DayPicker-Week):not(.DayPicker-Day--outside)');
    for (let i = 0; i < checkInDatePicker.length; i++) {
      let day = await checkInDatePicker[i].evaluate(el => el.innerText);
      if (day == checkInDate.date()) {
        agoda.page.evaluate(el => el.click(), checkInDatePicker[i])
      }
    }
  },
  selectcheckOutDate: async(currentTime, checkInDate, checkOutDate) => {
    let startOfCurrentMonth = currentTime.clone().startOf('month');
    let startOfMonthCheckInDate = checkInDate.clone().startOf('month');
    let startOfMonthCheckOutDate = checkOutDate.clone().startOf('month');
    let checkInCurrentMonthDiff = startOfMonthCheckInDate.diff(startOfCurrentMonth, 'month');
    let checkOutCheckInMonthDiff = startOfMonthCheckOutDate.diff(startOfMonthCheckInDate, 'month');
    for (let i = 0; i < checkOutCheckInMonthDiff - 1; i++) {
      await agoda.page.click('span[data-selenium=calendar-next-month-button]')
    }
    if (checkInCurrentMonthDiff > 1 && checkOutCheckInMonthDiff > 0) {
      await agoda.page.click('span[data-selenium=calendar-next-month-button]')
    }
    await agoda.page.waitFor('div[data-selenium=rangePickerCheckOut]');
    let checkOutDatePickerWrapper = await agoda.page.$('div[data-selenium=rangePickerCheckOut] > div:first-child > div[class=DayPicker] > div:first-child');
    let checkOutDatePicker = (checkInCurrentMonthDiff == 0 && checkOutCheckInMonthDiff == 0) ?  await checkOutDatePickerWrapper.$$('div[class=DayPicker-Months] > div:nth-child(1) > div[class=DayPicker-Body] div:not(.DayPicker-Day--disabled):not(.DayPicker-Week):not(.DayPicker-Day--outside)') 
      :  await checkOutDatePickerWrapper.$$('div[class=DayPicker-Months] > div:nth-child(2) > div[class=DayPicker-Body] div:not(.DayPicker-Day--disabled):not(.DayPicker-Week):not(.DayPicker-Day--outside)');
    for (let i = 0; i < checkOutDatePicker.length; i++) {
      let day = await checkOutDatePicker[i].evaluate(el => el.innerText);
      if (day == checkOutDate.date()) {
        agoda.page.evaluate(el => el.click(), checkOutDatePicker[i])
      }
    }
  }
}

module.exports = agoda;
