# import libraries
from datetime import timedelta
import icalendar
import json
import os 
import pytz

# get timezone for sydney
sydney_timezone = pytz.timezone('Australia/Sydney')

# get ics file path and open for reading
ics_file_path = os.path.join('99.95','backend', 'Aarav.ics')
cal = icalendar.Calendar.from_ical(open(ics_file_path, 'rb').read())

# get the directory of the current Python script
script_dir = os.path.dirname(__file__)

# Define the path for the JSON file in the same directory
json_file = os.path.join(script_dir, "output.json")

# create master dictionary
master_dict = {}

# create a function to read data from ics file and store immediately in master_dict
def ical_to_json(date):    
    # create an array (list) in the master dictionary named after the date
    master_dict[str(date.date())] = []

    for component in cal.walk():
        if component.name == "VEVENT":
            # get the start date of event
            start_date = component.get('dtstart').dt

            # convert start date to Sydney Time
            start_date = start_date.replace(tzinfo=pytz.utc)
            sydney_start = start_date.astimezone(sydney_timezone)

            # check if event date is today's date
            if sydney_start.date() == date.date():
                # get end date and convert to sydney time in preperation to append to the array
                end_date = component.get('dtend').dt
                end_date = end_date.replace(tzinfo=pytz.utc)
                sydney_end = end_date.astimezone(sydney_timezone)                

                # append nameless object (dictionary) with relevant data to array
                master_dict[str(date.date())].append({
                    "class": str(component.get('summary').partition(": ")[0]),
                    "name": str(component.get('summary').partition(": ")[2]),
                    "location": str(component.get('location').partition(": ")[2]),
                    "teacher": str(component.get('description').splitlines()[0].partition(": ")[2]),
                    "period": str(component.get('description').splitlines()[1].partition(": ")[2]),
                    "start_time": str(sydney_start.strftime("%Y-%m-%dT%H:%M:%S")),
                    "end_time": str(sydney_end.strftime("%Y-%m-%dT%H:%M:%S")),

                })

# create function to determine no. of days ics file spans over, inclusive 
def days_covered_by(cal):
    # create array to store all dates in ical, including duplicates
    all_ical_dates = []

    # go through list an append every date into all_ical_dates
    for component in cal.walk():
        if component.name == "VEVENT":
            tempdate = component.get('dtstart').dt
            tempdate = tempdate.replace(tzinfo=pytz.utc)
            tempdatesyd = tempdate.astimezone(sydney_timezone)
            all_ical_dates.append(tempdatesyd.date())

    # find difference between first and last added date
    d0 = all_ical_dates[0]
    d1 = all_ical_dates[len(all_ical_dates) - 1]
    delta  = d1 - d0

    return delta.days + 1

# create function to determine first date in ical:
def first_date(cal):
    for component in cal.walk():
        if component.name == "VEVENT":
            tempdate = component.get('dtstart').dt
            tempdate = tempdate.replace(tzinfo=pytz.utc)
            first_date = tempdate.astimezone(sydney_timezone)
            return first_date

# run ical_to_json accross all dates in calenda
for i in range(days_covered_by(cal)):
    ical_to_json(first_date(cal) + timedelta(days = i))


# dump master_dict to json
with open(json_file, "w") as f:
    json.dump(master_dict, f, indent=4)

