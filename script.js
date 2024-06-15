const PIDS = {
  agora: 201403,
  "agora-blok-rooms": 201403,
  "agora-flexispace": 201403,
  ebib: 201406,
  "arenberg-main": 201401,
  "arenberg-rest": 201401,
  "arenberg-tulp": 201401,
  erasmus: 201404,
  "agora-rooms": 202203,
};

// Set default date to today
let today = new Date();
let dd = String(today.getDate()).padStart(2, "0");
let mm = String(today.getMonth() + 1).padStart(2, "0"); //January is 0!
let yyyy = today.getFullYear();

// Format today's date
let minDate = yyyy + "-" + mm + "-" + dd;

// Set the min date for the input field
let dateInput = document.getElementById("date");
dateInput.value = minDate;
dateInput.min = minDate;

// Set the max date for the input field
let maxDate = yyyy + "-" + mm + "-" + (parseInt(today.getDate()) + 9);
dateInput.max = maxDate;

// Load saved r-number from local storage
const savedRNumber = localStorage.getItem("rNumber");



if (savedRNumber) {
  document.getElementById("rNumber").value = savedRNumber;
}

function switchLanguage(option) {

  localStorage.setItem("language", option);
  translateSpans(`i18n/${option}.txt`);
}

const savedLanguage = localStorage.getItem("language");

if (savedLanguage) {
  switchLanguage(savedLanguage);
} else {
  switchLanguage("en");
}

async function fetchTimeslots(date, uid) {
  const selectedLibrary = document.getElementById('selectedCardID').value;

  const seats = await fetch(`/seats/${selectedLibrary}.json`).then(response =>
    response.json()
  );

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const formattedDate = `${year}-${month}-${day}`;

  const startDateTime = `${formattedDate}T00:00:00`;

  const nextDay = new Date(date);
  nextDay.setDate(date.getDate() + 1);
  const nextDayYear = nextDay.getFullYear();
  const nextDayMonth = String(nextDay.getMonth() + 1).padStart(2, "0");
  const nextDayDay = String(nextDay.getDate()).padStart(2, "0");
  const nextDayFormattedDate = `${nextDayYear}-${nextDayMonth}-${nextDayDay}`;

  const endDateTime = `${nextDayFormattedDate}T00:00:00`;

  const url = `https://wsrt.ghum.kuleuven.be/service1.asmx/GetReservationsJSON?uid=${uid}&ResourceIDList=${Object.keys(
    seats
  ).join(",")}&startdtstring=${startDateTime}&enddtstring=${endDateTime}`;

  const timeslots = await fetch(url)
    .then(response => response.json())
    .then(data =>
      data.map(item => ({
        resource_id: item.ResourceID,
        date: new Date(item.Startdatetime),
        status: item.Status,
      }))
    );

  return [timeslots, seats];
}

function sortTimeslots(timeslots, seats) {
  const sortedTimeslots = {};
  for (const [resourceId, resourceName] of Object.entries(seats)) {
    sortedTimeslots[resourceName] = {
      resourceId: parseInt(resourceId),
      reservations: timeslots.filter(
        reservation => reservation.resource_id === parseInt(resourceId)
      ),
    };
  }
  return sortedTimeslots;
}

function renderTable(sortedTimeslots, selectedDate, selectedLibrary) {
  const table = document.getElementById("seatTable");
  table.innerHTML = `
        <tr>
            <th><span id="name-column-label">Name</span></th>
            ${[...Array(24)].map((_, index) => `<th>${index}</th>`).join("")}
            <th colspan="2"><span id="actions-label">Actions</span></th>
        </tr>
    `;

  for (const [resourceName, resourceData] of Object.entries(sortedTimeslots)) {
    const resourceReservations = resourceData.reservations;
    let rowHtml = `<tr><td class="smolFont">${resourceName}</td>`;

    for (let hour = 0; hour < 24; hour++) {
      const hourReservations = resourceReservations.filter(
        reservation => reservation.date.getHours() === hour
      );

      let displayStatus = "A";
      if (hourReservations.length > 0) {
        if (hourReservations[0].status === "U") {
          displayStatus = "U"; // Unavailable
        } else if (hourReservations[0].status === "B") {
          displayStatus = "B"; // Booked
        } else if (hourReservations[0].status === "C") {
          displayStatus = "C"; // Closed
        }
      }

      const cellClass =
        displayStatus === "U" || displayStatus === "C"
          ? "unavailable"
          : displayStatus === "B"
          ? "booked"
          : "available";

      const displayStatusImg =
        displayStatus === "U" || displayStatus === "C"
          ? "unavailable.svg"
          : displayStatus === "B"
          ? "booked.svg"
          : "available.svg";
      rowHtml += `<td class="${cellClass}"><img src="assets/${displayStatusImg}"></td>`;
    }

    const selectedMonth = String(selectedDate.getMonth() + 1).padStart(2, "0");
    const selectedDay = String(selectedDate.getDate()).padStart(2, "0");
    const selectedYear = selectedDate.getFullYear();
    const selectedFormattedDate = `${selectedYear}-${selectedMonth}-${selectedDay}`;

    var theme = document.documentElement.getAttribute('data-bs-theme') || 'light';
    var buttonClass = theme === 'dark' ? 'btn-dark' : 'btn-light';

    const checkInLink = `https://kuleuven.be/kurtqr?id=${resourceData.resourceId}`;
    const bookLink = `https://www-sso.groupware.kuleuven.be/sites/KURT/Pages/default.aspx?pid=${PIDS[selectedLibrary]}&showresults=done&resourceid=${resourceData.resourceId}&startDate=${selectedFormattedDate}T00%3A00%3A00`;
    rowHtml += `<td class="smolFont"><button class="btn ${buttonClass} btn-sm" onClick='openBookingDialog(${JSON.stringify(
      {
        resourceId: resourceData.resourceId,
        reservations: resourceReservations,
      }
    )})'><span id="book-label">Book</span></button></td><td class="smolFont"><button class="btn ${buttonClass} btn-sm" onClick='window.open("${checkInLink}")'><span id="check-in-label">Check In</span></button></td>`;

    rowHtml += "</tr>";
    table.insertAdjacentHTML("beforeend", rowHtml);
  }

  // Show the table after rendering
  table.style.display = "table";
}

let currentlyBooking = {};

function openBookingDialog(resourceData) {
  const dialog = document.getElementById("bookDialog");
  dialog.showModal();

  currentlyBooking = resourceData;

  document.getElementById("startTime").innerHTML = "";

  const reservationAvailable = isReservationAvailable(
    document.getElementById("date").value
  );

  for (let i = 0; i < 24; i++) {
    const option = document.createElement("option");
    option.value = i;
    option.textContent = `${i}:00`;
    option.disabled =
      reservationAvailable &&
      resourceData.reservations.some(
        reservation => new Date(reservation.date).getHours() === i
      );
    document.getElementById("startTime").appendChild(option);
  }

  refreshDropdowns(document.getElementById("startTime").value);
}

document.getElementById("bookDialog").addEventListener("close", function () {
  currentlyBooking = {};
});

function isReservationAvailable(targetDateInput) {
  const now = new Date();

  const targetDate = new Date(targetDateInput);

  targetDate.setHours(18, 0, 0, 0); // Reservation opens at 18:00

  // Check if the target date is within the next 8 days
  if (targetDate.getTime() - now.getTime() <= 8 * 24 * 60 * 60 * 1000) {
    return true;
  } else {
    return false;
  }
}

function generateLink() {
  const startTime = document.getElementById("startTime").value;
  const endTime = document.getElementById("endTime").value;

  const selectedDate = new Date(document.getElementById("date").value);

  const startTimeFormatted = `${selectedDate.getFullYear()}-${String(
    selectedDate.getMonth() + 1
  ).padStart(2, "0")}-${String(selectedDate.getDate()).padStart(
    2,
    "0"
  )}T${startTime.padStart(2, "0")}:00:00`;

  const endTimeFormatted = `${selectedDate.getFullYear()}-${String(
    selectedDate.getMonth() + 1
  ).padStart(2, "0")}-${String(
    endTime == 0 ? selectedDate.getDate() + 1 : selectedDate.getDate()
  ).padStart(2, "0")}T${endTime.padStart(2, "0")}:00:00`;

  return `https://www-sso.groupware.kuleuven.be/sites/KURT/Pages/NEW-Reservation.aspx?StartDateTime=${startTimeFormatted}&EndDateTime=${endTimeFormatted}&ID=${currentlyBooking.resourceId}&type=b`;
}

document.getElementById("bookButton").addEventListener("click", function () {
  window.open(generateLink());
});

document
  .getElementById("copyLink")
  .addEventListener("click", async function () {
    try {
      await navigator.clipboard.writeText(generateLink());
      this.textContent = "Copied!";
      this.disabled = true;
    } catch (err) {
      console.error("Failed to copy!", err);
      this.textContent = "Failed to copy!";
      this.disabled = true;
    }

    setTimeout(() => {
      this.textContent = "Copy link";
      this.disabled = false;
    }, 1000);
  });

function refreshDropdowns(startTime) {
  console.log(startTime);
  const selectedStartTime = parseInt(startTime);
  const selectedEndTime = selectedStartTime + 1;

  document.getElementById("endTime").innerHTML = "";

  const reservationAvailable = isReservationAvailable(
    document.getElementById("date").value
  );

  if (reservationAvailable) {
    document.getElementById("reservationClosed").style.display = "none";
  } else {
    document.getElementById("reservationClosed").style.display = "block";
  }

  console.log(reservationAvailable);

  for (let i = selectedEndTime; i < 24; i++) {
    // Only allow to select if the timeslot is available and if by selecting this time, there is no booked timeslot between the selected start and end time
    const option = document.createElement("option");
    option.value = i;
    option.textContent = `${i}:00`;
    option.disabled =
      reservationAvailable &&
      currentlyBooking.reservations.some(
        reservation =>
          new Date(reservation.date).getHours() >= selectedStartTime &&
          new Date(reservation.date).getHours() < i
      );
    document.getElementById("endTime").appendChild(option);
  }

  // Add 00:00 as the last option
  const option = document.createElement("option");
  option.value = "0";
  option.textContent = `00:00`;
  option.disabled = currentlyBooking.reservations.some(
    reservation =>
      new Date(reservation.date).getHours() > selectedStartTime &&
      new Date(reservation.date).getHours() <= 23
  );

  document.getElementById("endTime").appendChild(option);

  if (selectedEndTime === 24) {
    option.selected = true;
  }
}

document
  .getElementById("startTime")
  .addEventListener("change", e => refreshDropdowns(e.target.value));

document
  .getElementById("queryForm")
  .addEventListener("submit", function (event) {
    event.preventDefault();

    const selectedDate = new Date(document.getElementById("date").value);
    const rNumberField = document.getElementById("rNumber");
    let rNumber = rNumberField.value;

    // Check if the r-number starts with 'r' and add it if it doesn't
    if (!rNumber.startsWith("r")) {
      rNumber = `r${rNumber}`;
      rNumberField.value = rNumber;
    }

    // Throw a pop-up if the r-number is obviously not valid.
    if (!/^([rsm]\d{7})$/.test(rNumber)) {
      alert("Invalid ID. An ID must start with 'r', 's', or 'm', followed by 7 numbers.");
      return;
      
    }
  

    // Check if the checkbox is checked
    const rememberRNumber = document.getElementById("rememberRNumber").checked;

    // Save r-number to local storage only if the checkbox is checked
    if (rememberRNumber) {
      localStorage.setItem("rNumber", rNumber);
    } else {
      localStorage.removeItem("rNumber");
    }

    const fetchButton = document.getElementById("fetchButton");
    let previousButtonText = fetchButton.textContent;

    fetchButton.textContent = "Fetching...";
    fetchButton.disabled = true;

    // Hide the table before fetching data
    document.getElementById("seatTable").style.display = "none";

    fetchTimeslots(selectedDate, rNumber)
      .then(([timeslots, seats]) => sortTimeslots(timeslots, seats))
      .then(sortedTimeslots => {
        renderTable(
          sortedTimeslots,
          selectedDate,
          document.getElementById('selectedCardID').value
        );
        fetchButton.textContent = previousButtonText;
        fetchButton.disabled = false;

        //update the text in the form to the right language.
        const savedLanguage = localStorage.getItem("language");
        if (savedLanguage) {
          switchLanguage(savedLanguage);
        } else {
          switchLanguage("en");
        }
        
      });
  });

  function translateSpans(TranslationFile) {
    fetch(TranslationFile)
    .then(response => response.text())
    .then(text => {
        var translations = text.split('\n');
        translations.forEach(translation => {
            var [key, value] = translation.split('=');
            var elements = document.querySelectorAll('[id="' + key + '-label"]');
            elements.forEach(element => {
                element.innerHTML = value;
            });
        });
        
        // Notice text part
        var noticeText = document.getElementById('notice-label');
        if (noticeText) {
          var noticeKey = 'notice';
          var noticeTranslation = translations.find(t => t.startsWith(noticeKey + '='));
          if (noticeTranslation) {
              var noticeValue = noticeTranslation.substring(noticeTranslation.indexOf('=') + 1);
              noticeText.innerHTML = noticeValue;
          }
      }
    })
    .catch(error => console.error('Error loading localization file:', error));
  }


  //table scripts
  var dropdownToggle = document.getElementById('dropdownMenuButton');
  var dropdownMenu = dropdownToggle.nextElementSibling;

  function toggleDropdown() {
    if (dropdownMenu.style.display === 'block') {
      dropdownMenu.style.display = 'none';
    } else {
      dropdownMenu.style.display = 'block';
    }
  }

  dropdownToggle.addEventListener('click', toggleDropdown);

  function selectCard(cardText, cardID) {
    dropdownToggle.innerText = cardText;
    dropdownMenu.style.display = 'none';

    // Set the hidden input value
    document.getElementById('selectedCardID').value = cardID;
  }

  function toggleCompactMode() {
    const cards = document.querySelectorAll('.dropdown-menu .card');
    cards.forEach(card => {
      card.classList.toggle('compact-mode');
    });
  }

  document.addEventListener('DOMContentLoaded', function() {
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        document.documentElement.setAttribute('data-bs-theme', 'dark');
        var buttons = document.querySelectorAll('.btn-light');
        buttons.forEach(function(button) {
            button.classList.remove('btn-light');
            button.classList.add('btn-dark');
        });
    }
});


document.addEventListener('DOMContentLoaded', function() {
  var modal = document.getElementById('imageModal');
  var folderButtons = document.querySelectorAll('#dropdownMenu .card');
  var carouselInner = modal.querySelector('.carousel-inner');
  var openMapCarousel = document.getElementById('openMapCarousel');

  folderButtons = Array.from(folderButtons);

  folderButtons.forEach(function(button) {
    button.addEventListener('click', function() {
      console.log(this.getAttribute('data-folder'))
      var folder = this.getAttribute('data-folder');
      loadImages(folder);
    });
  });

  function loadImages(folder) {
    carouselInner.innerHTML = '';
    var carouselIndicators = document.querySelector('#carouselExample .carousel-indicators');
    carouselIndicators.innerHTML = ''; 
  
    var imageFilenames = getImageFilenames(folder);
  
    imageFilenames.forEach(function(filename, index) {
      var item = document.createElement('div');
      item.classList.add('carousel-item');
      if (index === 0) {
        item.classList.add('active');
      }
  
      var imageContainer = document.createElement('div');
      imageContainer.classList.add('image-container');
  
      var img = document.createElement('img');
      img.src = 'maps/' + folder + '/' + filename; 
      img.alt = 'Zoomable Image ' + (index + 1);
      img.classList.add('panzoom-element');
  
      imageContainer.appendChild(img);
      item.appendChild(imageContainer);
      carouselInner.appendChild(item);
  
      var indicator = document.createElement('li');
      indicator.setAttribute('data-bs-target', '#carouselExample');
      indicator.setAttribute('data-bs-slide-to', index.toString());
      if (index === 0) {
        indicator.classList.add('active');
      }
      carouselIndicators.appendChild(indicator);
    });
  
    // Initialize Panzoom for images
    var images = modal.querySelectorAll('.panzoom-element');
    images.forEach(function(image) {
      panzoom(image, {
        minScale: 1,
        maxScale: 3,
      });
    });
  
    openMapCarousel.style.display = 'initial';
  
    var carousel = new bootstrap.Carousel(document.getElementById('carouselExample'), {
      interval: false, 
    });
  }

  function getImageFilenames(folder) {
    switch (folder) {
      case 'agora':
        return ['flexispace.webp', 'silentstudy1.webp', 'silentstudy2.webp'];
      case 'antwerpen':
        return ['floor1.jpg','floor2.jpg','floor3.jpg'];
      case 'arenberg':
        return [
          'Arenberg_Campusbibliotheek_KURT_Seats_def-1.webp',
          'Arenberg_Campusbibliotheek_KURT_Seats_def-2.webp',
          'Arenberg_Campusbibliotheek_KURT_Seats_def-3.webp',
          'Arenberg_Campusbibliotheek_KURT_Seats_def-4.webp',
        ];
      case 'ebib':
        return ['101-124.webp', '125-154.webp', '155-414.webp', '415-444.webp'];
      case 'erasmushuis':
        return [
          'floor0.webp',
          'floor1.webp',
          'floor2.webp',
          'floor3.webp',
          'floor4.webp',
          'floor5.webp',
          'floor6.webp',
          'floor7.webp'
        ];
      case 'kulak':
        return ['basement_50.webp', 'floorone_50.webp', 'groundfloor_50.webp'];
      default:
        return [];
    }
  }
});
