# import libraries
import datetime 
import icalendar
import json
import os 
import pytz

#create function to extract dates relavent to today from given ics file
def events_today(ics_file):
  # read ics file
  cal = icalendar.Calendar.from_ical(open(ics_file, 'rb').read())

  # get today's date
  today = datetime.date(2024, 8, 22)

  # create lists to return
  events_today = []
  events_start = []
  events_end = []
  
  # get timezone for sydney
  sydney_timezone = pytz.timezone('Australia/Sydney')

  # go through entire dataset
  for component in cal.walk():
    if component.name == "VEVENT":
        # get start date and time
        start_date = component.get('dtstart').dt

        # convert start date and time to sydney time
        start_date = start_date.replace(tzinfo=pytz.utc)
        sydney_start = start_date.astimezone(sydney_timezone)

        if sydney_start.date() == today:
            # get end date and time
            end_date = component.get('dtend').dt
            
            # convert end date and time to sydney time
            end_date = end_date.replace(tzinfo=pytz.utc)
            sydney_end = end_date.astimezone(sydney_timezone)

            # append to list as STRINGS
            events_today.append(component.get('summary'))
            events_start.append(sydney_start.strftime("%Y-%m-%d %H:%M:%S"))
            events_end.append(sydney_end.strftime("%Y-%m-%d %H:%M:%S"))

  return events_today, events_start, events_end

# inputs ics path and extract relavent data
ics_file_path = os.path.join('99.95','backend', 'Aarav.ics')
todays_events, todays_start, todays_end = events_today(ics_file_path)

# print relavent data
for i in range(len(todays_events)):
   print('- ', todays_events[i], 'from', todays_start[i], 'to', todays_end[i])

# merge data into datastructure
data = {
    "events": todays_events,
    "start_times": todays_start,
    "end_times": todays_end
}



    