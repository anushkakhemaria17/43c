import requests

BASE_URL = "http://localhost:8000/api/customers/"

def test_register(mobile, name):
    url = f"{BASE_URL}register/"
    data = {
        "username": mobile,
        "mobile": mobile,
        "name": name,
        "email": f"{mobile}@example.com"
    }
    print(f"Testing Register with {mobile}...")
    try:
        res = requests.post(url, json=data)
        print(f"Status: {res.status_code}")
        print(f"Response: {res.text}")
    except Exception as e:
        print(f"Error: {e}")

def test_login(mobile):
    url = f"{BASE_URL}login/"
    data = {"mobile": mobile}
    print(f"Testing Login with {mobile}...")
    try:
        res = requests.post(url, json=data)
        print(f"Status: {res.status_code}")
        print(f"Response: {res.text}")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    # Test a new registration
    test_register("1112223334", "Test User")
    # Test login for the same number
    test_login("1112223334")
